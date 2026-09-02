# Tech Spec: Voice Pipeline Hardening & Optimization

**Project:** VocalGrid | **Stack:** Next.js 15 (App Router) + TypeScript
**Scope:** STT context biasing, local semantic matching, schema-driven type parsing
**Related:** `docs/05_VOICE_PIPELINE.md`, `docs/07_MATCHING_ENGINE.md`, `lib/matching/REFACTORING.md`, `docs/features/01_cache_warming.md`
**Status:** Done

---

## Table of Contents

1. [Design Review Flags (Read First)](#1-design-review-flags-read-first)
2. [Requirement 1: Context-Aware STT (Whisper Prompt Injection)](#2-requirement-1-context-aware-stt)
   - 2.1 [Prompt Injection Design](#21-prompt-injection-design)
   - 2.2 [Token Budget & Truncation Strategy](#22-token-budget--truncation-strategy)
   - 2.3 [Hallucination Guardrails](#23-hallucination-guardrails)
   - 2.4 [Local Contextual Biasing — Feasibility Verdict](#24-local-contextual-biasing--feasibility-verdict)
3. [Requirement 2: VectorMatcher (New Chain Level)](#3-requirement-2-vectormatcher)
   - 3.1 [Model Selection (Correction)](#31-model-selection-correction)
   - 3.2 [Runtime Constraint: Edge vs Node.js](#32-runtime-constraint-edge-vs-nodejs)
   - 3.3 [Architecture & Data Flow](#33-architecture--data-flow)
   - 3.4 [Code Blueprints](#34-code-blueprints)
   - 3.5 [Chain Integration](#35-chain-integration)
4. [Requirement 3: Schema-Driven Column Type Parsers](#4-requirement-3-schema-driven-column-type-parsers)
   - 4.1 [Parser Registry (Strategy Pattern)](#41-parser-registry-strategy-pattern)
   - 4.2 [Bilingual Number Parser](#42-bilingual-number-parser)
   - 4.3 [Bilingual Boolean Parser](#43-bilingual-boolean-parser)
   - 4.4 [Text Normalization (Hebrew-Aware)](#44-text-normalization-hebrew-aware)
5. [Updated Pipeline Diagram & Thresholds](#5-updated-pipeline-diagram--thresholds)
6. [Rollout Plan (Step-by-Step)](#6-rollout-plan-step-by-step)
7. [Risks & Open Questions](#7-risks--open-questions)
8. [Bottom Line](#8-bottom-line)

---

## 1. Design Review Flags (Read First)

Direct corrections to the request before implementation begins:

- **🔴 `all-MiniLM-L6-v2` is the wrong model for this product.** It is English-only. Hebrew inputs will embed as near-noise and cosine scores will be unreliable exactly where you need semantic rescue most. Use **`paraphrase-multilingual-MiniLM-L12-v2`** (Hebrew + English in shared vector space). See §3.1.
- **🔴 `runtime = 'edge'` blocks local inference.** `app/api/parse/route.ts` and `app/api/voice-entry/route.ts` declare Edge runtime. ONNX inference (transformers.js) requires the Node.js runtime. The voice-entry route must move to `runtime = 'nodejs'`. See §3.2.
- **🟠 The existing `parseNumber` is broken for the exact example you gave.** `lib/parsers/value-parsers.ts` has no `hundred`/`thousand` multiplier logic — "one hundred fifty-six" currently returns `57` (1+50+6), not `156`. This is a bug fix, not just a feature. See §4.2.
- **🟠 The existing `PhoneticMatcher` (Soundex) is English-only.** Hebrew inputs fall straight through phonetic to fuzzy. VectorMatcher becomes the primary Hebrew rescue level — factor this into threshold tuning. See §5.
- **🟠 True decoder-level contextual biasing without an external STT API is not possible with OpenAI Whisper API.** There is a pragmatic local alternative — see §2.4 for the honest breakdown.

---

## 2. Requirement 1: Context-Aware STT

### 2.1 Prompt Injection Design

Whisper's `prompt` parameter conditions the decoder on preceding "context" text. Feeding it the representative-column vocabulary biases transcription toward those exact spellings (names, SKUs, Hebrew terms).

**Integration point:** `app/api/voice-entry/route.ts` (unified route) and `app/api/transcribe/route.ts`.

```typescript
// lib/server/stt/context-prompt.ts

const WHISPER_PROMPT_TOKEN_LIMIT = 224; // Hard decoder limit — excess is silently truncated from the START

export function buildWhisperPrompt(entities: string[], opts?: {
  recentEntities?: string[];   // entities matched in this session — highest priority
  maxTokens?: number;
}): string {
  const limit = opts?.maxTokens ?? 200; // safety margin under 224
  // Priority order: recently-used first, then remaining vocabulary
  const ordered = dedupe([...(opts?.recentEntities ?? []), ...entities]);

  const parts: string[] = [];
  let tokenCount = 0;
  for (const e of ordered) {
    const t = estimateTokens(e) + 1; // +1 for separator
    if (tokenCount + t > limit) break;
    parts.push(e);
    tokenCount += t;
  }
  // Natural-sentence glossary format biases better than a bare CSV list
  return `Vocabulary: ${parts.join(', ')}.`;
}

// Heuristic: ~1 token per 4 chars Latin, ~1 per 2 chars Hebrew (Hebrew tokenizes denser)
function estimateTokens(s: string): number {
  const hebrewChars = (s.match(/[\u0590-\u05FF]/g) ?? []).length;
  const otherChars = s.length - hebrewChars;
  return Math.ceil(hebrewChars / 2) + Math.ceil(otherChars / 4);
}
```

```typescript
// In the transcription call:
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1',
  language: lang,                 // keep explicit 'he'/'en' when known — improves biasing
  prompt: whisperPrompt,          // ← injected vocabulary
  response_format: 'verbose_json',
  temperature: 0,                 // ← REQUIRED with prompts; reduces hallucination amplification
});
```

**Where the entity list comes from:** the existing cache-warming flow (`docs/features/01_cache_warming.md`). On table open / representative-column change, the server caches `{ tableId → string[] entities }`. The prompt builder reads that cache — no extra DB round trip per utterance.

### 2.2 Token Budget & Truncation Strategy

- **Hard limit:** Whisper uses only the **final 224 tokens** of the prompt. Overflow is dropped from the *beginning* — so put highest-priority entities **last** if you ever exceed budget. Simpler: stay under budget (200-token cap above) and keep priority-first ordering.
- **Prioritization tiers** (fill until budget exhausted):
  1. Entities matched in the current session (`recentEntities`, from `entityCache`)
  2. Entities with empty cells in the active column (likely next targets)
  3. Remaining vocabulary, alphabetical
- **Large tables (500+ entities):** you cannot fit them all (~3–6 tokens/name → ~40–60 names max). Accept partial coverage; the matcher chain + VectorMatcher handles the rest. Do **not** try rotating prompts per request — non-determinism makes debugging transcription regressions impossible.
- **Bilingual tables:** include Hebrew entities as-is (UTF-8). Do not transliterate — Whisper is natively multilingual and the exact-spelling bias is the entire point.

### 2.3 Hallucination Guardrails

Prompts increase the risk that Whisper "echoes" vocabulary on silence/noise. Mitigations (all cheap):

- **`temperature: 0`** — non-negotiable when using prompts.
- **Extend the existing `isWhisperHallucination()`** in `app/api/voice-entry/route.ts`: flag transcripts that are *exactly* one prompt entity with no value component AND audio duration < 500ms.
- **Use `verbose_json` segments:** discard segments with `no_speech_prob > 0.6` or `avg_logprob < -1.0`.
- **A/B guard metric:** log `promptUsed: boolean` alongside existing performance logs; compare exact-match rate at level 1 of the chain with/without prompt. Expected: exact-match rate ↑ 15–30% for name-heavy tables. If hallucination-filter hit rate rises > 2×, shrink the prompt.

### 2.4 Local Contextual Biasing — Feasibility Verdict

Direct answer to "can we avoid the external API using local contextual biasing":

- **Decoder-level biasing (the real thing) — NO with OpenAI API.** Contextual biasing (boosted beams / shallow fusion over a phrase list) happens *inside* the ASR decoder. OpenAI exposes only the `prompt` knob. You cannot inject a bias list any deeper without owning the decoder.
- **Fully local STT — possible but not recommended now.**
  - *Server-side:* `whisper.cpp` / `faster-whisper` on a Node server can run whisper-small with real prompt control and even token-level logit biasing. But this is incompatible with Vercel serverless (model size, CPU time, cold starts). It requires a dedicated GPU/CPU worker (Fly.io / Railway / EC2) — an infra project, not a route change.
  - *Client-side:* transformers.js can run whisper-tiny/base in-browser via WebGPU. Hebrew WER on tiny/base is significantly worse than whisper-1; on mid-range mobile devices latency exceeds the API round trip. Rejected for v1.
- **The pragmatic "local biasing" you already half-own:** the matcher chain **is** post-STT contextual biasing. STT returns its best guess; Exact → Phonetic → Fuzzy → **Vector** snaps it onto the closed vocabulary locally, with the LLM as final fallback. Strengthening the chain (Req 2) delivers ~90% of decoder-biasing value at ~0% infra cost.
- **Recommendation:** Whisper API + prompt injection (primary) + hardened local chain (this spec). Revisit self-hosted `faster-whisper` only if API cost/latency becomes a measured problem.

---

## 3. Requirement 2: VectorMatcher

### 3.1 Model Selection (Correction)

| Model | Hebrew | Size (quantized ONNX) | Dim | Verdict |
|---|---|---|---|---|
| `all-MiniLM-L6-v2` (requested) | ❌ English-only | ~23 MB | 384 | **Rejected** — fails the bilingual requirement |
| `paraphrase-multilingual-MiniLM-L12-v2` | ✅ (50+ langs, shared space) | ~50 MB | 384 | **✅ Selected** |
| `multilingual-e5-small` | ✅ | ~45 MB | 384 | Viable alternative; requires `query:`/`passage:` prefixes — more footguns |

**Key property of the selected model:** Hebrew and English embed into a *shared* space — "דוד לוי" and "David Levy" land near each other. This directly solves your "Hebrew speech → English entity" mapping without transliteration hacks.

**Runtime:** `@huggingface/transformers` (transformers.js v3), quantized ONNX (`dtype: 'q8'`), CPU inference. Expected: ~15–40ms per single-sentence embedding on Vercel Node functions after warm-up.

### 3.2 Runtime Constraint: Edge vs Node.js

- **Blocker:** `export const runtime = 'edge'` in `app/api/voice-entry/route.ts` and `app/api/parse/route.ts`. Edge functions cannot load a 50MB ONNX model (code-size limits, no fs, no WASM threads at this scale).
- **Change:** `export const runtime = 'nodejs'` on any route that touches `VectorMatcher`. Latency cost of losing Edge (~50–100ms TTFB) is dwarfed by the LLM calls you're eliminating (~1,500ms).
- **Cold starts:** first invocation per instance downloads/loads the model (~2–5s). Mitigations:
  - Bundle model files into the deployment (`env.localModelPath`, ship under `/models`) — removes network fetch, leaves ~1–2s ONNX session init.
  - Lazy singleton (blueprint below): pay init once per instance, never per request.
  - Chain design already tolerates this: levels 1–3 answer most requests without touching the model; guard `VectorMatcher` with a timeout → fall through to LLM.

### 3.3 Architecture & Data Flow

```
┌──────────────── ENTITY INDEX LIFECYCLE (write path, rare) ────────────────┐
│ Table opened / representative column changed / rows edited               │
│   → warm-cache job (existing, docs/features/01)                           │
│   → NEW: embed all entity labels in ONE batched call                      │
│   → persist: Upstash Redis  key: vecidx:{tableId}:{columnHash}            │
│              value: { model, dim, labels[], vectors: base64(Float32) }    │
│   → hydrate into per-instance memory Map<tableId, EntityIndex>            │
└────────────────────────────────────────────────────────────────────────────┘

┌──────────────── MATCH REQUEST (read path, hot) ───────────────────────────┐
│ transcript entity-part → chain levels 1–3 (exact/phonetic/fuzzy) miss     │
│   → VectorMatcher:                                                        │
│       1. embed input (~15–40ms, local)                                    │
│       2. brute-force cosine vs N entity vectors (N ≤ ~2k → sub-ms)        │
│       3. score ≥ 0.75 AND margin(top1−top2) ≥ 0.05 → match ('semantic')   │
│          margin < 0.05 → AMBIGUOUS (feed existing ambiguity UI)           │
│          score < 0.75 → chain miss → LLM fallback (existing)              │
└────────────────────────────────────────────────────────────────────────────┘
```

- **No pgvector / vector DB.** For ≤ a few thousand entities per table, brute-force cosine over an in-memory `Float32Array` is sub-millisecond. A vector DB here is résumé-driven over-engineering.
- **Persistence in Redis, compute in memory.** Serverless instances are ephemeral; the Redis copy makes hydration a ~10ms read instead of re-embedding (~N × 20ms) on every cold instance.
- **Invalidation:** reuse existing invalidation triggers (schema change, entity edits) — delete `vecidx:{tableId}:*` alongside the current `entityCache.clear(tableId)`.

### 3.4 Code Blueprints

```typescript
// lib/server/embeddings/embedding-service.ts
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

env.localModelPath = process.env.MODEL_PATH ?? './models'; // bundled with deploy
env.allowRemoteModels = false;                              // no runtime downloads in prod

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

let instance: Promise<FeatureExtractionPipeline> | null = null;

export function getEmbedder(): Promise<FeatureExtractionPipeline> {
  // Lazy singleton — survives across warm invocations of the same instance
  instance ??= pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
  return instance;
}

export async function embed(texts: string[]): Promise<Float32Array[]> {
  const extractor = await getEmbedder();
  const out = await extractor(texts, { pooling: 'mean', normalize: true }); // normalized → cosine = dot
  return texts.map((_, i) => out[i].data as Float32Array);
}
```

```typescript
// lib/server/embeddings/entity-index.ts
export interface EntityIndex {
  model: string;
  dim: number;
  labels: string[];
  vectors: Float32Array[]; // normalized
}

// Called from the existing warm-cache job
export async function buildEntityIndex(labels: string[]): Promise<EntityIndex> {
  const vectors = await embed(labels.map(normalizeForEmbedding)); // batched, one pass
  return { model: MODEL_ID, dim: 384, labels, vectors };
}

export function cosineTopK(query: Float32Array, index: EntityIndex, k = 3) {
  const scored = index.vectors.map((v, i) => ({ label: index.labels[i], score: dot(query, v) }));
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // vectors are pre-normalized
}
```

```typescript
// lib/matching/vector-match.ts
import type { Matcher, MatchResult } from './types';

export class VectorMatcher implements Matcher {
  readonly name = 'vector';

  constructor(
    private getIndex: () => EntityIndex | null,   // injected — matcher stays pure/testable
    private embedFn: (t: string) => Promise<Float32Array>,
    private opts = { minScore: 0.75, minMargin: 0.05, timeoutMs: 300 },
  ) {}

  // NOTE: requires the async chain variant — see §3.5
  async match(input: string, _entities: string[]): Promise<MatchResult> {
    const index = this.getIndex();
    if (!index) return this.noMatch(); // index not hydrated → fall through, never block

    try {
      const q = await withTimeout(this.embedFn(normalizeForEmbedding(input)), this.opts.timeoutMs);
      const [top1, top2] = cosineTopK(q, index, 2);

      if (!top1 || top1.score < this.opts.minScore) return this.noMatch();
      if (top2 && top1.score - top2.score < this.opts.minMargin) {
        return { matched: null, confidence: top1.score, matchType: 'semantic',
                 ambiguous: [top1, top2] };           // → existing AMBIGUOUS flow
      }
      return { matched: top1.label, confidence: top1.score, matchType: 'semantic' };
    } catch {
      return this.noMatch(); // timeout/error → LLM fallback handles it
    }
  }

  private noMatch(): MatchResult {
    return { matched: null, confidence: 0, matchType: 'none' };
  }
}
```

### 3.5 Chain Integration

The current `Matcher` interface is synchronous; embedding is async. Two options:

- **Option A (rejected):** make every matcher async. Pollutes three working sync matchers and their tests.
- **Option B (✅ selected):** add `AsyncMatcherChain` that accepts `Matcher | AsyncMatcher` and awaits only when needed. Sync matchers keep their exact signatures — zero changes to existing classes, preserving the backward-compat guarantee from `REFACTORING.md`.

```typescript
// lib/matching/types.ts — additive only
export interface AsyncMatcher {
  match(input: string, entities: string[]): Promise<MatchResult>;
  readonly name: string;
}

// lib/matching/matcher.ts — updated factory
export function createDefaultMatcherChain(deps: VectorDeps): AsyncMatcherChain {
  return new AsyncMatcherChain()
    .addMatcher(new ExactMatcher())                     // sync, ~0ms
    .addMatcher(new PhoneticMatcher())                  // sync, ~0ms (EN only)
    .addMatcher(new FuzzyMatcher(2))                    // sync, ~1ms
    .addMatcher(new VectorMatcher(deps.getIndex, deps.embed)); // async, ~20–40ms
  // chain miss → existing gpt-4o-mini fallback in the route (unchanged)
}
```

- `matchType: 'semantic'` already exists in `ParsedResult` / `entityCache` — vector hits flow into the existing cache with **zero schema changes**, so a semantic rescue is a one-time cost per phrase per table.

---

## 4. Requirement 3: Schema-Driven Column Type Parsers

### 4.1 Parser Registry (Strategy Pattern)

Replace the `switch(column.type)` in `normalizeValue()` (duplicated in both `parse` and `voice-entry` routes) with a single registry — same pattern language as the matcher chain:

```typescript
// lib/parsers/registry.ts
export interface ValueParser<T = unknown> {
  readonly type: ColumnType;
  parse(raw: string, ctx: ParseContext): T | null;   // null = unparseable → valueValid: false
}

export interface ParseContext {
  language: 'he' | 'en' | 'auto';   // from Whisper's language_detected
  validation?: ColumnValidation;
}

const registry = new Map<ColumnType, ValueParser>([
  [ColumnType.NUMBER,  new NumberParser()],
  [ColumnType.BOOLEAN, new BooleanParser()],
  [ColumnType.DATE,    new DateParser()],     // wraps existing chrono-node logic
  [ColumnType.TEXT,    new TextParser()],
]);

export function parseForColumn(raw: string, column: ColumnDefinition, ctx: ParseContext) {
  const parser = registry.get(column.type) ?? registry.get(ColumnType.TEXT)!;
  const value = parser.parse(raw, ctx);
  return { value, ...validateValue(value, column.type, column.validation) }; // existing validator
}
```

**Pipeline position:** parsers run on the *value part* of the transcript **after** entity/value splitting, replacing `normalizeValue()`. The column type is known from `activeCell.columnId` → schema lookup (already done for the LLM prompt).

### 4.2 Bilingual Number Parser

**Bug fix first:** current implementation is additive-only — no multipliers. "one hundred fifty-six" → `57`. The fix is the standard accumulator algorithm:

```typescript
// lib/parsers/number/spoken-number.ts — core algorithm (shared EN/HE)
const EN = {
  units: { zero:0, one:1, two:2, /* … */ nineteen:19 },
  tens:  { twenty:20, thirty:30, /* … */ ninety:90 },
  scales:{ hundred:100, thousand:1_000, million:1_000_000 },
};

// Hebrew: both gender forms are valid speech ("שלוש" / "שלושה") — map both.
// Strip the conjunction prefix ו־ ("חמישים ושש" → "חמישים שש") before lookup.
const HE = {
  units: { 'אפס':0, 'אחת':1, 'אחד':1, 'שתיים':2, 'שניים':2, 'שלוש':3, 'שלושה':3,
           'ארבע':4, 'ארבעה':4, 'חמש':5, 'חמישה':5, 'שש':6, 'שישה':6,
           'שבע':7, 'שבעה':7, 'שמונה':8, 'תשע':9, 'תשעה':9, 'עשר':10, 'עשרה':10 },
  teens: { 'אחת עשרה':11, 'שתים עשרה':12, /* … */ },      // two-word lookahead
  tens:  { 'עשרים':20, 'שלושים':30, 'ארבעים':40, 'חמישים':50,
           'שישים':60, 'שבעים':70, 'שמונים':80, 'תשעים':90 },
  scales:{ 'מאה':100, 'מאתיים':200, 'מאות':100, 'אלף':1_000, 'אלפיים':2_000, 'אלפים':1_000 },
};

export function parseSpokenNumber(input: string, lang: 'he' | 'en' | 'auto'): number | null {
  const tokens = tokenize(input, lang); // lowercase, strip ו־ prefix (HE), split hyphens (EN)
  let total = 0, current = 0, consumed = false;

  for (const tok of tokens) {
    const v = lookup(tok, lang);           // tries HE then EN when lang === 'auto'
    if (v === null) continue;              // skip filler words ("uh", "אה")
    consumed = true;
    if (v === 100)      current = (current || 1) * 100;         // "מאה" alone = 100
    else if (v >= 1000) { total += (current || 1) * v; current = 0; }
    else                current += v;
  }
  if (consumed) return total + current;

  // Digit fallback: handles "156", "156.5", "1,234" — and Whisper often emits digits anyway
  const n = parseFloat(input.replace(/,/g, '').trim());
  return Number.isNaN(n) ? null : n;
}
// "one hundred fifty six" → 156 ✅   "מאה חמישים ושש" → 156 ✅   "eighty five" → 85 ✅
```

- **Special HE cases to encode:** `מאתיים` (200) and `אלפיים` (2000) are irregular single words; `שלוש מאות` = 3×100 (the `מאות` plural triggers multiplication); decimal spoken as `נקודה` / "point".
- **Reality check:** Whisper usually normalizes spoken numbers to digits already ("156"). The word-parser is the safety net, not the main path — keep the digit fallback first-class.

### 4.3 Bilingual Boolean Parser

Lives in `lib/shared/parsers/boolean-parser.ts` (shared zone, not server-only) —
`normalizeText` is its only dependency and is pure, so both the voice pipeline
(`lib/server/parsers/registry.ts`'s `BooleanParser`) and the manual-edit path
(`lib/shared/parsers/cell-value.ts`, used by `DataTableCell.tsx`) run the
exact same vocabulary. This is the fix for a past bug: the manual path used
to send the raw typed string with no coercion, so a legacy string value like
`"no"` rendered as `✓` (truthy-tested) instead of `✗`.

```typescript
// lib/shared/parsers/boolean-parser.ts
const TRUE_SET = new Set([
  // EN
  'yes','true','present','here','check','checked','done','complete','completed','correct','1','y',
  // HE
  'כן','נכון','חיובי','בוצע','הושלם','יש','נוכח','נוכחת','כאן','אישור','וי',
]);
const FALSE_SET = new Set([
  'no','false','absent','not here','uncheck','unchecked','not done','incomplete','wrong','0','n',
  'לא','שלילי','לא בוצע','חסר','חסרה','נעדר','נעדרת','לא כאן','ביטול','אין',
]);

export function parseBoolean(input: string): boolean | null {
  const norm = normalizeText(input); // §4.4 — critical: strips niqqud, trailing punctuation
  if (TRUE_SET.has(norm)) return true;
  if (FALSE_SET.has(norm)) return false;
  return null; // never guess on booleans — null → valueValid: false → user confirms
}
```

- **Design rule:** exact-set membership only, no fuzzy matching on booleans. A fuzzy "לא" ↔ "כן" error writes the *opposite* value silently — worst possible failure mode for data entry.
- Word lists live in a config file, not code — domain tables will need custom vocab ("עבר"/"נכשל").

### 4.4 Text Normalization (Hebrew-Aware)

One shared normalizer used by TextParser, boolean sets, cache keys, and pre-embedding text:

```typescript
// lib/shared/parsers/text-normalizer.ts
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[\u0591-\u05C7]/g, '')     // strip niqqud/cantillation (Whisper sometimes emits them)
    .replace(/[.,!?;:״"']+$/g, '')       // trailing punctuation incl. gershayim
    .replace(/\s+/g, ' ')
    .trim();
}

// For MATCHING ONLY (fuzzy/cache keys — not for stored values):
export function normalizeForMatching(input: string): string {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[ךםןףץ]/g, c => ({ 'ך':'כ','ם':'מ','ן':'נ','ף':'פ','ץ':'צ' }[c]!)); // final-letter folding
}
```

- **TextParser stores `normalizeText` output** (display-safe), never the matching-normalized form.
- Final-letter folding matters: STT segmentation can produce medial/final mismatches that break exact/fuzzy matching for no linguistic reason.

---

## 5. Updated Pipeline Diagram & Thresholds

```
Audio ─► /api/voice-entry (runtime: nodejs ← changed)
  │
  ├─ 1. Whisper API  + prompt(entity vocab, ≤200 tok) + temperature:0     [~1–2s]
  ├─ 2. Hallucination filter (existing + §2.3 additions)
  ├─ 3. transcriptCache / entityCache (existing, unchanged)
  ├─ 4. Entity/value split → AsyncMatcherChain:
  │      L1 Exact    (sync)   conf 1.0            [~0ms]
  │      L2 Phonetic (sync)   conf ≥ 0.85, EN-only [~0ms]
  │      L3 Fuzzy    (sync)   conf ≥ 0.85          [~1ms]
  │      L4 Vector   (async)  score ≥ 0.75, margin ≥ 0.05, timeout 300ms  [~20–40ms]  ← NEW
  │      Miss → gpt-4o-mini fallback (existing)    [~1,500ms]
  ├─ 5. Value → Parser Registry by column.type (§4)                        ← NEW
  └─ 6. validateValue → UPDATE_CELL / AMBIGUOUS / ERROR (existing)
```

**Threshold rationale:**

- Vector `minScore: 0.75` is deliberately below the chain's 0.85: cosine scores of the multilingual model are not calibrated to fuzzy-ratio semantics. Do not reuse 0.85 blindly — it would make L4 nearly dead. Tune from logged score distributions after 1–2 weeks.
- `minMargin: 0.05` routes near-ties into the existing AMBIGUOUS UX instead of silently picking top-1 — cheap insurance for sibling names ("Dana"/"Dina", "דנה"/"דינה").
- **Expected impact:** LLM fallback rate is the KPI. Target: cut LLM_FALLBACK path share by 50–70% for bilingual tables; P95 for previously-LLM-bound utterances drops ~1,500ms → ~50ms.

---

## 6. Rollout Plan (Step-by-Step)

| # | Step | Effort | Risk |
|---|---|---|---|
| 1 | **Fix `parseNumber` multiplier bug** + unit tests (EN) | 0.5d | None — pure fix |
| 2 | **Parser Registry** + bilingual number/boolean/text parsers + tests (HE/EN fixtures) | 2d | Low |
| 3 | **Whisper prompt injection** behind flag `stt_context_prompt`, wired to warm-cache vocab | 1d | Low — flag-gated |
| 4 | **Runtime migration** `edge → nodejs` on voice routes; verify latency delta in staging | 0.5d | Medium — measure TTFB |
| 5 | **Embedding service + entity index** into warm-cache job; Redis persistence | 2d | Medium |
| 6 | **`VectorMatcher` + `AsyncMatcherChain`** behind flag `vector_matcher`; sync matchers untouched | 2d | Low — additive |
| 7 | **Observability:** log per-level hit rates, vector score distribution, prompt A/B metric | 1d | None |
| 8 | Threshold tuning from production logs; ramp flags 10% → 100% | ongoing | — |

Order is deliberate: steps 1–3 ship value with zero architectural risk while 4–6 are in review.

---

## 7. Risks & Open Questions

- **Deployment size:** ~50MB model must fit Vercel's function bundle (250MB limit incl. node_modules — verify with `next build` output). Fallback: model on Vercel Blob/S3 + instance-level disk cache (adds ~1–3s to cold start only).
- **Concurrency:** module-level singletons (embedder, hydrated indexes) are per-instance; under burst traffic multiple instances each pay hydration. Acceptable; do not add distributed locking.
- **Hebrew phonetics gap remains:** Soundex stays EN-only. If vector-level Hebrew rescue proves insufficient, a HE phonetic algorithm (e.g., custom key folding on top of `normalizeForMatching`) is a future L2b — out of scope here.
- **Open question:** should vector AMBIGUOUS results still escalate to the LLM (which sees the *value* context and can disambiguate), or go straight to the user? Recommend: LLM first, user second — measure.
- **Open question:** per-table custom boolean vocab UI (teacher tables: "עבר"/"נכשל") — product decision, schema slot exists (`validation` JSON).

---

## 8. Bottom Line

- **Req 1:** Inject warm-cache vocabulary into Whisper's `prompt` (≤200 tokens, priority-ordered, `temperature: 0`). True local decoder biasing is impossible with OpenAI's API — the hardened matcher chain *is* your local biasing layer, and that's the right trade.
- **Req 2:** Add `VectorMatcher` as L4 using **`paraphrase-multilingual-MiniLM-L12-v2`** (not `all-MiniLM-L6-v2` — English-only, fails your Hebrew requirement). Requires `runtime: 'nodejs'`. Brute-force cosine in-memory, Redis-persisted index, `AsyncMatcherChain` keeps all existing sync matchers untouched.
- **Req 3:** Strategy-pattern parser registry keyed by `ColumnType`; fix the existing multiplier bug in `parseNumber` (currently returns 57 for "one hundred fifty-six"), add HE/EN number + boolean maps, and Hebrew-aware normalization (niqqud strip, final-letter folding).
- **Payoff:** 50–70% fewer LLM fallbacks, ~1,450ms P95 saved on semantic-rescue paths, correct bilingual typed values — all additive to the existing Chain of Responsibility with zero breaking changes.
