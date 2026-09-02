// ─────────────────────────────────────────────────────────────────────────────
// Batch entry resolution — the navigation-mode convergence point
// docs/features/03_ai_table_agent.md §5.3/§5.5
// ─────────────────────────────────────────────────────────────────────────────

import type { ColumnDefinition, RowDefinition, TableSchema } from '@/lib/shared/types/table-schema';
import type { BatchCellWrite } from '@/lib/shared/types/voice-pipeline';
import { matchAsync } from '@/lib/server/matching/matcher';
import { parseForColumn, type ParseContext } from '@/lib/server/parsers/registry';
import { resolveRowFirstColumnTargets } from './batch-row-first';
import type { EntityGroup } from './batch-segmentation';

const AUTO_COMMIT_THRESHOLD = 0.85;
const DISAMBIGUATE_THRESHOLD = 0.6;

/** Shape returned by `matchAsync`, as consumed for confidence routing. */
interface EntityMatchResult {
  matched: string | null;
  confidence: number;
  matchType: string;
  candidates?: Array<{ entity: string; score: number }>;
}

/**
 * Confidence routing table shared by every navigation mode that resolves a
 * spoken entity against row labels (column-first, entity-first) — computed
 * once per entity match, never per value, so an entity-first group with
 * several values is routed once for the whole group.
 * docs/features/03_ai_table_agent.md §5.3, docs/features/18_entity_first_navigation.md §6
 */
function routeEntityMatch(
  matchResult: EntityMatchResult,
  matchedRow: Pick<RowDefinition, 'id' | 'label'> | undefined,
  parsedValid: boolean
): BatchCellWrite['confidenceRoute'] {
  const hasCloseCandidates = (matchResult.candidates?.length ?? 0) >= 2;

  if (!parsedValid) return 'parse_error';
  if (!matchedRow || matchResult.matchType === 'none') return 'unresolved';
  if (matchResult.confidence >= AUTO_COMMIT_THRESHOLD && !hasCloseCandidates) return 'auto';
  if (matchResult.confidence >= DISAMBIGUATE_THRESHOLD || hasCloseCandidates) return 'disambiguate';
  return 'unresolved';
}

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

  const confidenceRoute = routeEntityMatch(matchResult, matchedRow, parsed.valid);

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
 * Entity-first group resolution: one `matchAsync` call for the group's
 * entity (never per value), then a positional column-walk over
 * `group.rawValues` from the utterance's active column, parsing each value
 * for its landed column and carrying the group's real match confidence —
 * not row-first's hardcoded exact/1.0. Composes `matchAsync` and
 * `resolveRowFirstColumnTargets` rather than reimplementing either.
 * docs/features/18_entity_first_navigation.md §3.4, §6
 */
export async function resolveEntityFirstGroup(
  group: EntityGroup,
  tableSchema: TableSchema,
  activeCell: { tableColumnId: string },
  tableId: string,
  ctx: ParseContext
): Promise<{ writes: BatchCellWrite[]; overflowCount: number }> {
  const entities = tableSchema.rows.map((r) => r.label);
  const matchResult = await matchAsync(group.entityText, entities, tableId, {
    useCache: true,
    usePhonetic: true,
    useFuzzy: true,
    fuzzyThreshold: 4,
  });

  const matchedRow = matchResult.matched
    ? tableSchema.rows.find((r) => r.label === matchResult.matched)
    : undefined;

  const candidates = matchResult.candidates
    ?.map((c) => {
      const row = tableSchema.rows.find((r) => r.label === c.entity);
      return row ? { entity: c.entity, rowKey: row.id, confidence: c.score } : null;
    })
    .filter((c): c is { entity: string; rowKey: string; confidence: number } => c !== null);

  const { targets, overflowCount } = resolveRowFirstColumnTargets(
    activeCell,
    tableSchema,
    group.rawValues.length
  );

  const writes = targets.map((column, i) => {
    const rawValue = group.rawValues[i];
    const parsed = parseForColumn(rawValue, column, ctx);
    const confidenceRoute = routeEntityMatch(matchResult, matchedRow, parsed.valid);

    return {
      rowKey: matchedRow?.id ?? null,
      tableColumnId: column.id,
      value: parsed.value,
      valueValid: parsed.valid,
      rawValueText: rawValue,
      entity: matchedRow?.label ?? null,
      entityMatch: {
        original: group.entityText,
        matched: matchedRow?.label ?? null,
        confidence: matchResult.confidence,
        matchType: matchResult.matchType === 'none' ? null : matchResult.matchType,
      },
      confidenceRoute,
      candidates,
    } satisfies BatchCellWrite;
  });

  return { writes, overflowCount };
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
