/**
 * Whisper Context Prompt Builder
 * Injects known table vocabulary into Whisper's `prompt` parameter to bias
 * transcription toward exact entity spellings (names, SKUs, Hebrew terms).
 *
 * Based on: docs/features/10_voice-pipeline-hardening.md §2.1–2.2
 */

// Whisper only conditions on the final 224 tokens of the prompt; overflow is
// silently dropped from the START. We stay under a safety-margin cap instead
// of relying on that truncation behavior.
export const WHISPER_PROMPT_TOKEN_LIMIT = 224;
const DEFAULT_TOKEN_CAP = 200;

export interface BuildWhisperPromptOptions {
  /** Entities matched earlier in this session — highest priority. */
  recentEntities?: string[];
  /** Safety-margin token cap (default 200, under the 224 hard limit). */
  maxTokens?: number;
}

/**
 * Builds a token-budgeted, priority-ordered Whisper prompt from table
 * vocabulary. Recently-used entities are included first so they survive
 * the budget cutoff.
 */
export function buildWhisperPrompt(
  entities: string[],
  opts?: BuildWhisperPromptOptions
): string {
  const limit = opts?.maxTokens ?? DEFAULT_TOKEN_CAP;
  const ordered = dedupe([...(opts?.recentEntities ?? []), ...entities]);

  const parts: string[] = [];
  let tokenCount = 0;

  for (const entity of ordered) {
    const trimmed = entity.trim();
    if (!trimmed) continue;

    const tokens = estimateTokens(trimmed) + 1; // +1 for separator
    if (tokenCount + tokens > limit) break;

    parts.push(trimmed);
    tokenCount += tokens;
  }

  if (parts.length === 0) return '';

  // Natural-sentence glossary format biases better than a bare CSV list.
  return `Vocabulary: ${parts.join(', ')}.`;
}

/**
 * Heuristic token estimate: ~1 token per 4 chars Latin, ~1 per 2 chars
 * Hebrew (Hebrew tokenizes denser in Whisper's BPE vocabulary).
 */
const HEBREW_RANGE = new RegExp('[\\u0590-\\u05FF]', 'g');

export function estimateTokens(s: string): number {
  const hebrewChars = (s.match(HEBREW_RANGE) ?? []).length;
  const otherChars = s.length - hebrewChars;
  return Math.ceil(hebrewChars / 2) + Math.ceil(otherChars / 4);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
