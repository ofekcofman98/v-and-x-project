/**
 * Truncates text to fit within a character cap, cutting at the last sentence
 * boundary (`.`, `!`, `?`) under the cap rather than mid-sentence.
 * docs/features/17-voice-chat-loop.md §7
 */

/** Max characters sent to TTS per request — named per .claude/rules/typescript.md. */
export const MAX_SPEAK_CHARS = 500;

/**
 * Falls back to a hard cut at `maxChars` when no sentence boundary exists
 * under the cap (e.g. one long run-on sentence), so the output is never
 * silently empty.
 */
export function truncateAtSentence(text: string, maxChars: number = MAX_SPEAK_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const window = trimmed.slice(0, maxChars);
  const lastBoundary = Math.max(window.lastIndexOf('.'), window.lastIndexOf('!'), window.lastIndexOf('?'));

  if (lastBoundary > 0) return window.slice(0, lastBoundary + 1).trim();

  return window.trim();
}
