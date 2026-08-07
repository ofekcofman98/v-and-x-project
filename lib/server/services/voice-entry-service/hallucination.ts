// ─────────────────────────────────────────────────────────────────────────────
// Hallucination detection
// ─────────────────────────────────────────────────────────────────────────────

const WHISPER_HALLUCINATIONS: ReadonlySet<string> = new Set([
  'thank you',
  'thank you.',
  'thank you for watching',
  'thank you for watching.',
  'thank you for your time',
  'thank you for your time.',
  'thank you for the opportunity',
  'thank you for the opportunity.',
  'thank you for joining',
  'thank you for joining.',
  'thanks for watching',
  'thanks for watching.',
  'bye',
  'bye.',
  'goodbye',
  'goodbye.',
  '...',
  '. . .',
  'music',
  '[music]',
  '(music)',
  'silence',
  '[silence]',
  '(silence)',
]);

// Splits on sentence boundaries so a transcript stitched from multiple
// hallucinated phrases ("Thank you for your time.  Thank you for the
// opportunity.") is still recognized — the whole-string Set lookup above
// only ever catches a single phrase.
function splitIntoSentences(normalized: string): string[] {
  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns true when the transcript is a well-known Whisper hallucination.
 * Exported for unit testing.
 * docs/05_VOICE_PIPELINE.md §2.3, docs/features/10_voice-pipeline-hardening.md §2.3
 */
export function isWhisperHallucination(
  transcript: string,
  opts?: { audioDurationSec?: number; promptEntities?: string[] }
): boolean {
  const normalized = transcript.trim().toLowerCase();

  if (normalized.length < 2) return true;
  if (WHISPER_HALLUCINATIONS.has(normalized)) return true;
  if (/^[.,!?;:\s]+$/.test(normalized)) return true;

  // A transcript made up entirely of known-hallucination sentences (e.g.
  // Whisper stitching two stock phrases together on silence/noise) is a
  // hallucination even though the concatenated string is never itself a
  // Set member. Requires 2+ sentences so a single non-matching real
  // utterance ("Noa Cohen, 21.") never trips this on its own.
  const sentences = splitIntoSentences(normalized);
  if (sentences.length >= 2 && sentences.every((s) => WHISPER_HALLUCINATIONS.has(s))) return true;

  // Prompt-echo guard: a bare vocabulary entity with no value component on
  // a near-silent clip is almost always Whisper parroting the prompt back.
  const isBareEntityEcho = (opts?.promptEntities ?? []).some(
    (entity) => entity.trim().toLowerCase() === normalized
  );
  const isNearSilent = (opts?.audioDurationSec ?? Infinity) < 0.5;
  if (isBareEntityEcho && isNearSilent) return true;

  return false;
}

// A single token dominating this much of the transcript is treated as a
// degenerate repetition loop rather than real speech.
const REPETITION_RATIO_THRESHOLD = 0.4;
// Below this token count, even a repeated word (e.g. "yes yes yes") is
// plausibly real speech, not a decoder loop — only flag longer runs.
const REPETITION_MIN_TOKENS = 8;

/**
 * Detects Whisper's temperature-0 "repetition loop" failure mode: on
 * short/ambiguous audio the decoder can get stuck greedily repeating one
 * token dozens of times (e.g. "no, nie, nie, nie, nie, ...") instead of
 * admitting uncertainty. Exported for unit testing.
 * docs/06_SMART_POINTER_LOGS.md
 */
export function isDegenerateRepetition(transcript: string): boolean {
  const tokens = transcript
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.replace(/^[.,!?;:]+|[.,!?;:]+$/g, ''))
    .filter(Boolean);

  if (tokens.length < REPETITION_MIN_TOKENS) return false;

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const maxCount = Math.max(...counts.values());
  return maxCount / tokens.length >= REPETITION_RATIO_THRESHOLD;
}
