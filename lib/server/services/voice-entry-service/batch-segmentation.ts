// ─────────────────────────────────────────────────────────────────────────────
// Local (non-LLM) batch segmentation
// ─────────────────────────────────────────────────────────────────────────────

import { extractEntityQuick } from './quick-extract';
import { parseForColumn, type ParseContext } from '@/lib/server/parsers/registry';
import type { ColumnDefinition } from '@/lib/shared/types/table-schema';

const SEGMENT_SEPARATOR = /,|\band\b/i;
const BARE_NUMBER_TOKEN = /^\d+\.?\d*$/;
// Whisper occasionally renders a dictated list as numbered bullets
// ("26. Rachel Green, 85. Yossi Hertz, ...") rather than "Name, value" pairs
// — the leading digit there is a list marker, not a value. Ambiguous by
// construction: never guess which number (if either) is the real value.
const LEADING_NUMERIC_ARTIFACT = /^\d+[.\s]/;

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
 * Recombines a comma-split transcript into (entityText, rawValue) pairs when
 * the segments strictly alternate name / bare-number — the natural "Name,
 * value, Name, value, ..." dictation cadence ("Rachel Green, 72, Noa Cohen,
 * 33"). This is distinct from `extractEntityQuick`'s per-segment matching,
 * which requires the entity and value inside a SINGLE segment ("Dan 85");
 * here the naive comma scan already split them apart and this recombines
 * them. Returns null (not just "ambiguous" but "not this shape") when any
 * pair fails the alternation — including when an "entity" segment is itself
 * a list-numbering artifact — so the caller tries per-segment extraction
 * next.
 */
function recombineAlternatingPairs(
  segments: string[]
): { entityText: string; rawValue: string }[] | null {
  if (segments.length < 4 || segments.length % 2 !== 0) return null;

  for (let i = 0; i < segments.length; i += 2) {
    const entityText = segments[i];
    const rawValue = segments[i + 1];
    if (!BARE_NUMBER_TOKEN.test(rawValue)) return null;
    if (LEADING_NUMERIC_ARTIFACT.test(entityText) || BARE_NUMBER_TOKEN.test(entityText)) return null;
  }

  const pairs: { entityText: string; rawValue: string }[] = [];
  for (let i = 0; i < segments.length; i += 2) {
    pairs.push({ entityText: segments[i], rawValue: segments[i + 1] });
  }
  return pairs;
}

/**
 * Column-first local segmentation: splits a transcript into
 * `(entityText, rawValue)` pairs ("Dan 85, Noa 90"), trying the alternating
 * pair recombination first, falling back to the same "Entity, value" /
 * "Entity value" regex patterns the single-entry pipeline already applies
 * per-utterance (`extractEntityQuick`).
 * Returns null (ambiguous) if either strategy fails, or — when the active
 * column is supplied — if any resolved rawValue can't parse for that
 * column's type, so the caller falls back to LLM segmentation rather than
 * committing an unparseable value.
 * docs/features/03_ai_table_agent.md §5.4/§5.5
 */
export function segmentEntityValuePairsLocal(
  transcript: string,
  column?: Pick<ColumnDefinition, 'type' | 'validation'>,
  ctx?: ParseContext
): { entityText: string; rawValue: string }[] | null {
  const segments = splitSegments(transcript);
  if (segments.length < 2) return null;

  const recombined = recombineAlternatingPairs(segments);
  let entries: { entityText: string; rawValue: string }[];

  if (recombined) {
    entries = recombined;
  } else {
    entries = [];
    for (const segment of segments) {
      if (LEADING_NUMERIC_ARTIFACT.test(segment)) return null;
      const extracted = extractEntityQuick(segment);
      if (!extracted) return null;
      entries.push({ entityText: extracted.entity, rawValue: String(extracted.value) });
    }
  }

  if (column && ctx) {
    for (const entry of entries) {
      if (!parseForColumn(entry.rawValue, column, ctx).valid) return null;
    }
  }

  return entries;
}
