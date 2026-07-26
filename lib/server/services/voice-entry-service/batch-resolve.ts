// ─────────────────────────────────────────────────────────────────────────────
// Batch entry resolution — the navigation-mode convergence point
// docs/features/03_ai_table_agent.md §5.3/§5.5
// ─────────────────────────────────────────────────────────────────────────────

import type { ColumnDefinition, RowDefinition, TableSchema } from '@/lib/shared/types/table-schema';
import type { BatchCellWrite } from '@/lib/shared/types/voice-pipeline';
import { matchAsync } from '@/lib/server/matching/matcher';
import { parseForColumn, type ParseContext } from '@/lib/server/parsers/registry';

const AUTO_COMMIT_THRESHOLD = 0.85;
const DISAMBIGUATE_THRESHOLD = 0.6;

/**
 * Column-first entry resolution: fuzzy/phonetic-matches the spoken entity
 * text against the table's row labels (same `matchAsync` call the
 * single-entry LLM-fallback stage uses), then parses the value for the
 * active column, applying the confidence routing table from §5.3.
 */
export async function resolveColumnFirstEntry(
  entry: { entityText: string; rawValue: string },
  tableSchema: TableSchema,
  activeColumn: ColumnDefinition,
  tableId: string,
  ctx: ParseContext
): Promise<BatchCellWrite> {
  const entities = tableSchema.rows.map((r) => r.label);
  const matchResult = await matchAsync(entry.entityText, entities, tableId, {
    useCache: true,
    usePhonetic: true,
    useFuzzy: true,
    fuzzyThreshold: 4,
  });

  const parsed = parseForColumn(entry.rawValue, activeColumn, ctx);
  const matchedRow = matchResult.matched
    ? tableSchema.rows.find((r) => r.label === matchResult.matched)
    : undefined;

  const candidates = matchResult.candidates
    ?.map((c) => {
      const row = tableSchema.rows.find((r) => r.label === c.entity);
      return row ? { entity: c.entity, rowKey: row.id, confidence: c.score } : null;
    })
    .filter((c): c is { entity: string; rowKey: string; confidence: number } => c !== null);

  const hasCloseCandidates = (candidates?.length ?? 0) >= 2;

  let confidenceRoute: BatchCellWrite['confidenceRoute'];
  if (!parsed.valid) {
    confidenceRoute = 'parse_error';
  } else if (!matchedRow || matchResult.matchType === 'none') {
    confidenceRoute = 'unresolved';
  } else if (matchResult.confidence >= AUTO_COMMIT_THRESHOLD && !hasCloseCandidates) {
    confidenceRoute = 'auto';
  } else if (matchResult.confidence >= DISAMBIGUATE_THRESHOLD || hasCloseCandidates) {
    confidenceRoute = 'disambiguate';
  } else {
    confidenceRoute = 'unresolved';
  }

  return {
    rowKey: matchedRow?.id ?? null,
    tableColumnId: activeColumn.id,
    value: parsed.value,
    valueValid: parsed.valid,
    rawValueText: entry.rawValue,
    entity: matchedRow?.label ?? null,
    entityMatch: {
      original: entry.entityText,
      matched: matchedRow?.label ?? null,
      confidence: matchResult.confidence,
      matchType: matchResult.matchType === 'none' ? null : matchResult.matchType,
    },
    confidenceRoute,
    candidates,
  };
}

/**
 * Row-first entry resolution: no entity resolution at all — the row is
 * already fixed by the pointer (mirrors `resolveBareValueEntry`/Stage 3.5's
 * `isRowFirstMidRow` shortcut). Only two routes are reachable (`auto` /
 * `parse_error`) since there is no entity match to be ambiguous about.
 */
export function resolveRowFirstEntry(
  rawValue: string,
  targetColumn: ColumnDefinition,
  row: Pick<RowDefinition, 'id' | 'label'>,
  ctx: ParseContext
): BatchCellWrite {
  const parsed = parseForColumn(rawValue, targetColumn, ctx);

  return {
    rowKey: row.id,
    tableColumnId: targetColumn.id,
    value: parsed.value,
    valueValid: parsed.valid,
    rawValueText: rawValue,
    entity: row.label,
    entityMatch: {
      original: null,
      matched: row.label,
      confidence: 1,
      matchType: 'exact',
    },
    confidenceRoute: parsed.valid ? 'auto' : 'parse_error',
  };
}
