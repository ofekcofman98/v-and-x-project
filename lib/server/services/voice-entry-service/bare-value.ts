import { ColumnType } from '@/lib/shared/types/column-types';
import type { ColumnDefinition, RowDefinition } from '@/lib/shared/types/table-schema';
import { parseForColumn, type ParseContext } from '@/lib/server/parsers/registry';

// ─────────────────────────────────────────────────────────────────────────────
// Bare-value fast path resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves a transcript that names no entity — just a value — against the
 * already-selected activeCell. Only reachable once extractEntityQuick's
 * "Entity, value" two-token pattern has failed to match, so it never steals
 * an utterance that explicitly names a (possibly different) row.
 *
 * Scoped to NUMBER/BOOLEAN/DATE columns: those types have narrow, structured
 * syntax where a bare transcript is unambiguously "a value, not a name".
 * TEXT columns are deliberately excluded — a bare word there is genuinely
 * ambiguous between a value and a name, so it's left to the LLM fallback,
 * which still trusts the active row when GPT confirms no entity was spoken.
 *
 * Exported for unit testing (mirrors isWhisperHallucination's pattern of
 * exporting pure logic so it's testable without mocking OpenAI).
 */
export function resolveBareValueEntry(
  transcript: string,
  activeColumn: Pick<ColumnDefinition, 'type' | 'validation'>,
  activeRow: Pick<RowDefinition, 'label'>,
  ctx: ParseContext
): { matched: string; value: unknown } | null {
  if (activeColumn.type === ColumnType.TEXT) return null;

  const parsed = parseForColumn(transcript.trim(), activeColumn, ctx);
  if (!parsed.valid) return null;

  return { matched: activeRow.label, value: parsed.value };
}
