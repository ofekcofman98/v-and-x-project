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

  // Prompt-echo guard: a bare vocabulary entity with no value component on
  // a near-silent clip is almost always Whisper parroting the prompt back.
  const isBareEntityEcho = (opts?.promptEntities ?? []).some(
    (entity) => entity.trim().toLowerCase() === normalized
  );
  const isNearSilent = (opts?.audioDurationSec ?? Infinity) < 0.5;
  if (isBareEntityEcho && isNearSilent) return true;

  return false;
}
