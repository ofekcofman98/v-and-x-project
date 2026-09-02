# Real-Time Voice Entry Feedback & Navigation-Mode Presentation — Spec

**Feature:** 15 — Real-Time Voice Entry Feedback
**Priority:** High (UX)
**Dependencies:** `docs/05_VOICE_PIPELINE.md`, `docs/06_SMART_POINTER.md`, `docs/features/03_ai_table_agent.md`, `docs/features/10_voice-pipeline-hardening.md`, `docs/features/11_perf_and_navigation.md`, `.claude/rules/architecture.md`
**Status:** Spec — Not Started
**Last Updated:** 2026-08-08

---

## Table of Contents

1. [Problem](#1-problem)
2. [Constraints From The Existing System](#2-constraints-from-the-existing-system)
3. [Design: Two-Layer Feedback](#3-design-two-layer-feedback)
4. [Reconciliation Rules](#4-reconciliation-rules)
5. [Batch Utterances](#5-batch-utterances)
6. [Navigation-Mode Presentation](#6-navigation-mode-presentation)
7. [Implementation Plan](#7-implementation-plan)
8. [Also Worth Doing (Ranked)](#8-also-worth-doing-ranked)
9. [Out of Scope](#9-out-of-scope)
10. [Conflicts With Existing Specs](#10-conflicts-with-existing-specs)
11. [Milestones & Exit Criteria](#11-milestones--exit-criteria)

---

## 1. Problem

While a user is speaking, the app currently shows almost nothing. All of it lives in `components/voice/VoiceButtonInner.tsx`: two pulse rings (L79-90), a green orb, a level bar clamped to a 40% minimum width (L126-138) so it reads as an on/off lamp rather than a real meter, and the static text `'Listening for speech...'` (L153). **Nothing the user said is ever echoed back to them** — not while speaking, not after. The parsed entity/value only appears once `recordingState === 'confirming'`, 1.3–4s after the person stops talking.

A pipeline that meets its own 1.8s P50 budget (`docs/features/03_ai_table_agent.md` §1.1) still *feels* broken, because the UI gives the user nothing to look at during that window. The user's own account: 5 attempts to dictate a 6-entry list because failures were indistinguishable from silence.

Separately, `navigationMode` (`'column-first' | 'row-first'`) completely changes where the pointer advances next, but the grid renders identically in both modes — a single highlighted cell (`DataTableCell.tsx:148-155`). New users can't build a mental model of "what happens after I speak" from the UI alone.

---

## 2. Constraints From The Existing System

These are load-bearing and the design below is built directly against them.

1. **Whisper cannot stream.** `lib/server/services/voice-entry-service/transcription.ts:81-90` calls `whisper-1` with `response_format: 'verbose_json'`. There is no `stream: true`, and `whisper-1` does not support one. True interim transcription from the server is not possible without switching models (`gpt-4o-transcribe`) or adopting the Realtime API — both out of scope (§9).

2. **The browser has a free, instant ASR the codebase doesn't use.** `SpeechRecognition` / `webkitSpeechRecognition` — a repo-wide grep finds zero existing usage. It emits `isFinal: false` interim results within ~100ms of speech, no network cost, no API key. Supported in Chrome/Edge; absent in Safari/Firefox, where it must degrade to nothing rather than break anything.

3. **The client already holds every row label and id.** `components/shared-table/TableGridSection.tsx:44` builds `tableSchema = { columns, rows }`, and both `use-voice-pipeline.ts:111` and `use-continuous-voice.ts:82` serialize that same object into the request body. Nothing about row matching requires a round trip.

4. **The matcher's Levels 1–3 are already dependency-free, isomorphic TypeScript.** `lib/server/matching/{exact-match,phonetic-match,fuzzy-match,MatcherChain,types}.ts` import nothing but `./types` and `fastest-levenshtein` (works in the browser). `matcher.ts:37` already comments *"Levels 1-3 only, client-side"* — the module was written anticipating this. Only `vector-match.ts` (ONNX) is Node-bound. `lib/server/services/voice-entry-service/quick-extract.ts`'s `extractEntityQuick` is four regexes with zero imports.

5. **The authoritative transcript already reaches the browser and is thrown away.** `VoiceEntryResult.transcript` (`lib/shared/types/voice-pipeline.ts:46-54`) is returned by `app/api/voice-entry/route.ts:211`, but `use-voice-pipeline.ts:138` casts the JSON payload to `ParsedResult`, which has no `transcript` field. Displaying it is a type change, not a new data source.

6. **`volume` is already wired to the render layer at 60fps.** `use-vad.ts:204` (`setVolume` on every rAF tick) → `use-continuous-voice.ts:196` → `use-voice-pipeline.ts:307` (`visualLevel`) → `VoiceButtonInner.tsx:132`. A real waveform is a rendering change on data that already exists at the right cadence.

7. **Per-cell fine-grained store subscription is the established, spec-sanctioned pattern.** `DataTableCell.tsx:52-56` derives `isActive` from a Zustand selector scoped to that one cell; `docs/features/11_perf_and_navigation.md` §2a calls this out explicitly as the correct approach to avoid re-rendering the whole grid on voice updates. Any new highlight (column band, row band) must follow the same shape — a selector inside the cell, not a prop threaded down from `DataTable`.

**On the user's original question** — "can this happen, or does the LLM need to hear everything first?" — both are true simultaneously. The LLM/Whisper path genuinely cannot start until the utterance ends (or a VAD chunk flushes). But a *separate*, local, approximate path can react within ~100ms. §3 formalizes this as two layers instead of one.

---

## 3. Design: Two-Layer Feedback

Provisional feedback is fast, local, free, and explicitly styled as uncertain. Confirmed feedback is authoritative and is the only thing that ever writes a cell.

| | Provisional layer | Confirmed layer |
|---|---|---|
| Source | Web Speech API + client-side matcher (§2.2, §2.4) | Whisper + server pipeline (existing) |
| Latency | ~100ms, during speech | 1.3–4s, after speech ends |
| Marginal cost | $0 | unchanged |
| Styling | grey, italic, dashed outline | solid, forest green `#13501B` |
| Can write a cell? | **No — never** | Yes, exclusively |

If `SpeechRecognition` is unsupported, the provisional layer simply does not render. Nothing else in the pipeline is gated on it — the confirmed-transcript echo (§8.1) and the real waveform (§8.2) still apply in every browser.

### 3.1 Feedback timeline

```
t=0     user starts speaking
t+100ms "john sno…"                  provisional transcript, grey italic, near the orb
t+400ms "john snow"                  client matcher fires → John Snow's row: dashed grey outline
t+900ms "john snow ninety five"      provisional value "95" shown as a ghost hint
t+1.2s  user stops talking
t+1.4s  VAD flushes → real pipeline starts; provisional text dims (not cleared yet)
t+2.6s  Whisper returns "John Snow, 95" → replaces the grey text, solid
t+2.7s  server-side match confirms the row → dashed outline becomes the solid ring
t+2.8s  cell commits → existing green flash (`isJustUpdated`) → pointer advances
```

Wall-clock time to commit is unchanged. Perceived time-to-first-feedback drops from ~2.8s to ~100ms.

### 3.2 New client modules

- **`lib/client/hooks/voice/use-speech-shadow.ts`** — thin wrapper over `SpeechRecognition`. Exposes `{ interimTranscript: string, isSupported: boolean, start: () => void, stop: () => void }`. Feature-detects `window.SpeechRecognition ?? window.webkitSpeechRecognition`; if absent, `isSupported: false` and every method is a no-op. Follows the file/naming conventions of the other hooks in `lib/client/hooks/voice/`. This hook owns browser ASR lifecycle only — it has no opinion about tables, matching, or rows (mirrors the separation `.claude/rules/voice-pipeline.md` already requires between `useVoiceEntry`/`useVad`/`useContinuousVoice`).

- **`lib/client/hooks/voice/use-provisional-target.ts`** — consumes `interimTranscript`, `tableSchema`, `navigationMode`, `activeCell`. Runs `extractEntityQuick` then the shared matcher chain (relocated per §3.3) against `tableSchema.rows` labels, debounced (not run on every interim event — e.g. every 150ms or on word-boundary). Publishes `{ provisionalRowKey, provisionalValue }` to the store. This hook is the only place that combines the shadow transcript with table data — `use-speech-shadow.ts` stays table-agnostic. In row-first mode the row is already fixed by the pointer, so only `provisionalValue` is guessed (from the raw transcript, not run through the matcher) and published against the active row's key. In entity-first mode (docs/features/18_entity_first_navigation.md §7) the entity is matched once, from the first token of the utterance, then held (a `useRef`, reset at the utterance boundary) for the rest of the interim updates — unlike column-first, which re-matches on every update.

- **`components/shared-table/DataTableCell.tsx`** — renders `provisionalValue` as grey italic ghost text in place of the empty-cell placeholder, on the guessed cell (column-first) or the active cell (row-first). Display-only: it is never written to the cell and never covers an already-populated cell, so a wrong guess cannot be mistaken for a completed write. See §9 — this was originally deferred and has since been implemented.

- **`lib/client/stores/ui-store.ts`** — add a `provisionalFeedback` slice: `{ interimTranscript: string | null, provisionalRowKey: string | null, provisionalValue: string | null }` plus setters and a `clearProvisionalFeedback()` action. **Must be excluded from `partialize`** (`ui-store.ts:271-275`), same as `activeCell`/`continuousMode` — this is transient per-utterance state and must never survive a reload or leak into localStorage.

### 3.3 Relocations required by the lib-zone rule

`.claude/rules/architecture.md`: *"A client component or hook must never import from `lib/server/`."* `use-provisional-target.ts` is a client hook that needs the matcher and the quick-extract regexes, both of which currently live under `lib/server/`. Per the DRY/zone rules, the fix is to move the zone-agnostic pieces, not to duplicate them:

- `lib/server/matching/{exact-match,phonetic-match,fuzzy-match,MatcherChain,types}.ts` → `lib/shared/matching/`. `lib/server/matching/index.ts` re-exports from the new location so every existing server import (`matcher.ts`, `batch-resolve.ts`, etc.) is unchanged. `vector-match.ts`, `AsyncMatcherChain.ts`, and `cache.ts` (Node-bound: ONNX, `lru-cache` used server-side) stay in `lib/server/matching/`.
- `extractEntityQuick` (`lib/server/services/voice-entry-service/quick-extract.ts`) → `lib/shared/utils/`, re-exported from its old path.
- **Pre-existing violation to not carry forward:** `matcher.ts:50,58` uses `console.log`, which `.claude/rules/typescript.md` forbids outright. Anything relocated into `lib/shared/` must route through `lib/shared/logging/` or `lib/shared/monitoring/` instead of bringing `console.log` into a now-doubly-shared module.

### 3.4 Confirmed-layer changes

- **`components/voice/VoiceButtonInner.tsx`** — replace the clamped level bar (L126-138) with a real multi-bar waveform driven by the existing `visualLevel` value (adapt the `Waveform` component pattern from `docs/design/src/App.tsx:4-26` — bars of varying height/phase, not a single fill bar). Add a two-line transcript display beneath the orb: the provisional line (grey, italic, from `provisionalFeedback.interimTranscript`) and, once available, the confirmed line (solid, from the response's `transcript`). Add an `aria-live="polite"` region wrapping the status text — none exists anywhere in the voice surface today, which is a real accessibility gap for a hands-free/eyes-free product.
- **`lib/client/hooks/voice/use-voice-pipeline.ts:138`** — stop discarding the transcript: narrow the payload to `VoiceEntryResult | VoiceBatchResult` (both already carry `transcript: string`) instead of `ParsedResult`, and publish it so the component can render it.
- **`lib/shared/types/voice-pipeline.ts`** — no new fields needed; `transcript` already exists on both result types (§2.5). Only the client-side narrowing needs to change.

---

## 4. Reconciliation Rules

Web Speech and Whisper will disagree sometimes. These rules exist because an unspecified reconciliation produces a UI that flickers or, worse, shows something false with confidence:

1. Whisper's result **always** overwrites the provisional text, even when the provisional guess looked more accurate. The confirmed layer has no fallback path back to the provisional guess.
2. If the provisional row guess differs from the confirmed row, the provisional dashed outline is cleared **before** the confirmed solid ring paints — two rows must never be highlighted at once.
3. A provisional guess that never gets confirmed (user cancels, hallucination guard trips, confidence too low to route `auto`) must self-clear on a timeout, so a stale grey outline can't persist indefinitely. Timeout duration: implementation detail, target ~3s past speech end.
4. `clearProvisionalFeedback()` fires on: speech end (once the confirmed layer takes over), pipeline error, navigation-mode toggle, and active-cell change. It is idempotent and cheap — it's just clearing three store fields.

---

## 5. Batch Utterances

Per `docs/features/03_ai_table_agent.md` §5, a batch utterance ("Rachel Green 72, Noa Cohen 33, …") cannot be resolved by the server until segmentation runs over the **whole** transcript (`batch-orchestrator.ts:110`) — there is no partial-batch server result to show early. This is exactly where the provisional layer earns the most: the confirmed result is furthest away here (a 15s dictated list means up to 15s of visual silence today, per the VAD soft-cap behavior in `docs/05_VOICE_PIPELINE.md` §9.2).

- The provisional layer marks rows **cumulatively** as each name is recognized in the growing interim transcript — e.g. "Rachel Green" marks row 1 provisionally, then "Noa Cohen" marks row 2 without clearing row 1's mark.
- Provisional batch marks use a **"queued"** styling, visually distinct from the single-entry **"targeting"** style, so N grey-dashed rows read as "in progress" rather than "N cells about to be overwritten."
- No change to batch confirmation semantics: `BatchConfirmationStrip` and the partial-commit behavior (`03_ai_table_agent.md` §5.3) are unmodified. This is a purely additive display layer in front of the existing confirmation flow.

---

## 6. Navigation-Mode Presentation

Today both modes render a single highlighted cell (`DataTableCell.tsx:148-155`) with no visual distinction. The fix: the active cell's whole column (column-first) or whole row (row-first) gets a visible band, so the mechanism — "where will my next entry land?" — is legible without reading documentation.

- **Column-first** → the active cell's entire column gets a soft forest tint plus a header cap on `ColumnHeaderCell`; the active cell itself keeps its existing solid ring unchanged. Reads as "I am filling down this column."
- **Row-first** → the active row gets the band instead. Reads as "I am filling across this row."
- The band must be visibly weaker than the active-cell ring (so the pointer doesn't get lost inside its own highlight) and must compose with the existing zebra striping (`DataTable.tsx:195-199`) and the `isJustUpdated` green flash without either being visually swallowed.

### 6.1 Implementation shape

Following §2.7 (fine-grained subscription is the sanctioned pattern):

- **`DataTableCell.tsx`** — add two additional store selectors alongside the existing `isActive` one (L52-56): `isActiveColumn` (`activeCell?.tableColumnId === tableColumnId`) and `isActiveRow` (`activeCell?.rowKey === rowKey`), gated by `navigationMode`. The `memo` comparator (L208-217) needs **no change** — these are store subscriptions internal to the component, not new props — so this stays the cheap path: only the cells in the previous and next active column/row re-render, not the whole grid.
- **`ColumnHeaderCell.tsx`** — needs the header-cap treatment on the active column. It is not currently memoized and receives a freshly-constructed `column` object every render (`DataTable.tsx:29-40`), so — same as the cell — a direct store subscription is the right mechanism here, not a new prop that would be defeated by the object identity churn.
- **`ComputedCell.tsx`** — currently takes only `{ rowKey, formula }` (L15-18); it has no `tableColumnId` and so cannot currently know whether it's in the active column. Needs `tableColumnId` threaded through as a prop, or a computed-column cell will render as a visual hole in an otherwise-banded column.
- **`NavigationModeToggle.tsx`** — the toggle itself should hint at the band it controls (e.g. an icon or micro-preview), so switching modes and seeing the band shape match reinforces the mental model in one glance.

---

## 7. Implementation Plan

Files this spec governs, in dependency order:

1. **Relocation** (§3.3): move the five matcher files and `extractEntityQuick` into `lib/shared/`; leave re-exports at the old paths; fix the two `console.log` calls en route. Zero behavior change — verify via the existing matcher/pipeline test suites passing unmodified.
2. **Confirmed-layer transcript echo** (§3.4, independent of everything else — ship first): `use-voice-pipeline.ts` narrowing, `VoiceButtonInner.tsx` transcript line + `aria-live` region + real waveform.
3. **Provisional layer**: `use-speech-shadow.ts`, `use-provisional-target.ts`, `ui-store.ts` slice, then wire into `VoiceButtonInner.tsx` (grey line) — depends on step 1.
4. **Row/column highlight consumption** of the provisional store fields — depends on step 3, and on §6's `DataTableCell`/`ColumnHeaderCell`/`ComputedCell` changes, which can be built and shipped independently of the voice work (§6 has no dependency on §3–5).
5. **Reconciliation rules** (§4) — wire the clearing/overwrite logic once both layers exist.

---

## 8. Also Worth Doing (Ranked)

Ranked by perceived-improvement-to-effort ratio; answers "what else can be done so it doesn't feel slow."

1. **Echo the confirmed transcript.** The cheapest possible win — the data already arrives in the response and is discarded (§2.5). Even alone, it turns pipeline failures from mysterious into diagnosable ("oh, it heard 'John Snowden'").
2. **Real waveform instead of the 40%-clamped bar.** Pure render change on data (`visualLevel`) that's already flowing at 60fps (§2.6). The current bar can't distinguish "hearing you" from "microphone is dead."
3. **Optimistic row marking.** Zero server cost (§2.3, §2.4) and the single strongest "it understood me" signal — arrives roughly 2.5s before the server could say the same thing.
4. **State-labelled orb.** `isProcessing` currently shows a generic spinner for the whole 1.3–4s window; naming the stage ("Transcribing…" → "Matching…") makes the same wall-clock time read as shorter and is free — `performance-logging.ts:53-72` already tracks `pathTaken` and per-stage durations server-side, so the client would only need those fields surfaced.
5. **`aria-live` announcements.** Currently absent entirely (§2's exploration found none) — the orb's `aria-label` never changes while listening. Reuses the same string the visual status text already renders; the gap matters specifically because this is a hands-free, eyes-free product.

---

## 9. Out of Scope

- **Server-side SSE/NDJSON stage streaming.** Real but modest gain: on the fast (non-LLM) path the transcript is only ~5-30ms ahead of the final result (`pipeline.ts` timings, §2 exploration), so streaming stages would mostly help the LLM-fallback path (~1500ms window) — smaller payoff than the client-side provisional layer, which is available on every path including the fast one, for less engineering.
- **Switching STT models** (`gpt-4o-transcribe`, Realtime API) to get true server-side interim transcription. Bigger migration, cost/latency tradeoffs unverified, not needed given the Web Speech shadow achieves the same UX goal for $0.

---

## 10. Conflicts With Existing Specs

This spec supersedes parts of two existing documents; per `.claude/rules/documentation.md` ("if code and docs conflict, the docs win — flag it and ask before deviating"), these are flagged here rather than edited unilaterally, pending approval:

- **`docs/06_SMART_POINTER.md` §5.1 (Cell Highlighting)** still specifies a blue palette (`ring-blue-500 ring-inset`, `bg-blue-50`), while the implementation (`DataTableCell.tsx`) has already drifted to forest green (`#13501B`/`#f2f8f2`) — even the code's own comment at L184 still says "blue corner triangle" over a green triangle. §5.1 does not mention column/row-level highlighting at all. This spec's §6 should become the new source of truth for nav-mode visuals, and §5.1's palette reference should be corrected to match the shipped forest-green scheme.
- **`docs/06_SMART_POINTER.md` §5.3 (Mode Indicator)** currently specifies only button-variant + hint-text ("Filling down ↓" / "Filling right →") as the mode indicator. §6 of this spec extends that with the column/row band — an addition, not a contradiction, but §5.3 should cross-reference this document once implemented.
- **`docs/05_VOICE_PIPELINE.md` §9** documents the `RecordingState` machine and VAD chunking; this spec does not change any state or transition, only what's rendered during `listening`/`processing`. No conflict, but §9 should gain a pointer to this document once shipped, per the same house convention `03_ai_table_agent.md` uses for its own cross-links.

---

## 11. Milestones & Exit Criteria

### Phase 1 — Confirmed-layer echo (no new dependencies)
- [ ] `use-voice-pipeline.ts` stops discarding `transcript`
- [ ] `VoiceButtonInner.tsx`: transcript line, real waveform, `aria-live` region
- [ ] Exit: a user can see exactly what Whisper heard, every time, in every browser

### Phase 2 — Provisional layer (Web Speech shadow)
- [ ] Matcher/quick-extract relocation to `lib/shared/` (§3.3), zero behavior change, existing tests pass unmodified
- [ ] `use-speech-shadow.ts`, `use-provisional-target.ts`, `ui-store.ts` provisional slice
- [x] Ghost value rendered inside the target cell before commit (`DataTableCell.tsx`) — display-only, guarded to never cover a populated cell; covers both column-first and row-first (§3.2)
- [ ] Reconciliation rules (§4) implemented and covered by unit tests on the pure decision logic (mirrors the `vad-chunking.ts` pattern: extract reconciliation into a pure function, test that directly — no `@testing-library/react` in this repo, per prior work)
- [ ] Exit: in Chrome/Edge, a row visibly marks within ~500ms of saying a recognizable name, and always resolves to (or clears in favor of) the confirmed result — never left stale

### Phase 3 — Navigation-mode bands
- [ ] `DataTableCell.tsx`, `ColumnHeaderCell.tsx` selectors; `ComputedCell.tsx` gets `tableColumnId`
- [ ] `NavigationModeToggle.tsx` micro-preview
- [ ] Exit: toggling nav mode visibly changes which structural band (column vs. row) appears around the active cell, with no full-grid re-render (verify via React DevTools profiler — only the affected column/row's cells re-render on pointer move)

### Phase 4 — Doc reconciliation
- [ ] `docs/06_SMART_POINTER.md` §5.1 palette corrected to forest green; §5.3 cross-referenced (pending approval per §10)
- [ ] `docs/05_VOICE_PIPELINE.md` §9 cross-referenced (pending approval per §10)

---

*End of Real-Time Voice Entry Feedback Spec*
