// ─────────────────────────────────────────────────────────────────────────────
// Batch utterance detection gate
// ─────────────────────────────────────────────────────────────────────────────

const NUMBER_TOKEN_GLOBAL = /\d+\.?\d*/g;
const NUMBER_TOKEN = /\d+\.?\d*/;
const SEGMENT_SEPARATOR = /,|\band\b/i;

/**
 * Cheap, synchronous pre-check for whether a transcript carries more than one
 * entry ("Dan 85, Noa 90, Yossi 78" or "85, 90, 78") rather than a single
 * entity/value ("Dan 85", "85"). Runs before any segmentation, matching, or
 * LLM call so the overwhelmingly common single-entry path pays only this
 * regex scan.
 *
 * Single- and multi-entry transcripts are mutually exclusive by number
 * count: the existing single-entry fast paths (extractEntityQuick,
 * resolveBareValueEntry) only ever handle transcripts with exactly one
 * number, so there is no overlap to reconcile here.
 * docs/features/03_ai_table_agent.md §5.2
 */
export function looksLikeBatchUtterance(transcript: string): boolean {
  const trimmed = transcript.trim();
  if (!trimmed) return false;

  const numberCount = trimmed.match(NUMBER_TOKEN_GLOBAL)?.length ?? 0;
  if (numberCount >= 2) return true;

  const segments = trimmed.split(SEGMENT_SEPARATOR).map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return false;

  const segmentsWithNumbers = segments.filter((s) => NUMBER_TOKEN.test(s));
  return segmentsWithNumbers.length >= 2;
}
