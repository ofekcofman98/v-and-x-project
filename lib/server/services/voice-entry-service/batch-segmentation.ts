// ─────────────────────────────────────────────────────────────────────────────
// Local (non-LLM) batch segmentation
// ─────────────────────────────────────────────────────────────────────────────

import { extractEntityQuick } from './quick-extract';

const SEGMENT_SEPARATOR = /,|\band\b/i;

function splitSegments(transcript: string): string[] {
  return transcript
    .trim()
    .split(SEGMENT_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A segment counts as a single bare value only if it has no internal
 * whitespace-separated words beyond the value itself — "85" or "present"
 * are bare values, "Dan 85" is not (it still carries an entity name).
 */
function isBareValueToken(segment: string): boolean {
  return segment.trim().split(/\s+/).length === 1;
}

/**
 * Row-first local segmentation: splits a transcript into bare value tokens
 * only ("85, 90, 78"). No entity text is expected — the row is already
 * fixed by the pointer (mirrors `isRowFirstMidRow`'s shortcut).
 * Returns null (ambiguous) if any segment isn't a clean single token, so the
 * caller falls back to LLM segmentation.
 * docs/features/03_ai_table_agent.md §5.4/§5.5
 */
export function segmentBareValuesLocal(transcript: string): string[] | null {
  const segments = splitSegments(transcript);
  if (segments.length < 2) return null;
  if (!segments.every(isBareValueToken)) return null;
  return segments;
}

/**
 * Column-first local segmentation: splits a transcript into
 * `(entityText, rawValue)` pairs ("Dan 85, Noa 90"), reusing the same
 * "Entity, value" / "Entity value" regex patterns the single-entry pipeline
 * already applies per-utterance (`extractEntityQuick`).
 * Returns null (ambiguous) if any segment fails to match one of those
 * patterns, so the caller falls back to LLM segmentation.
 * docs/features/03_ai_table_agent.md §5.4/§5.5
 */
export function segmentEntityValuePairsLocal(
  transcript: string
): { entityText: string; rawValue: string }[] | null {
  const segments = splitSegments(transcript);
  if (segments.length < 2) return null;

  const entries: { entityText: string; rawValue: string }[] = [];

  for (const segment of segments) {
    const extracted = extractEntityQuick(segment);
    if (!extracted) return null;
    entries.push({ entityText: extracted.entity, rawValue: String(extracted.value) });
  }

  return entries;
}
