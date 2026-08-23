/**
 * Grid Agent Tool Executors
 *
 * Pure, LLM-agnostic TypeScript functions — no OpenAI import here. Each
 * takes an explicit `tableId` so the same functions can be reused unmodified
 * by a future multi-table BaseList agent (Phase 4) without refactoring.
 * Implements: docs/features/03_ai_table_agent.md §4.2.
 *
 * `updateCellsBatch` is deliberately absent as a mid-conversation executor —
 * only `executeUpdateCellsBatch` exists, and it is called exclusively by the
 * confirm/execute route after user approval, never by the agent loop.
 */

import { prisma } from '@/lib/prisma';
import { EntrySource, Prisma } from '@/lib/shared/generated/prisma/client';
import { getTableAccessContext, filterAccessibleColumns, canAccessColumn } from '@/lib/server/services/column-access';
import { validateValue } from '@/lib/server/parsers/value-parsers';
import { parseForColumn } from '@/lib/server/parsers/registry';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { ColumnValidation } from '@/lib/shared/types/table-schema';
import type {
  GridFilter,
  QueryGridDataArgs,
  QueryGridDataResult,
  GetGridSummaryResult,
  CellUpdate,
  UpdateCellsBatchResult,
} from '@/lib/shared/types/ai';
import { upsertCellsBatch } from '@/lib/server/services/cells';

/** Thrown when a tool argument references a columnKey that doesn't exist or isn't accessible to the caller. */
export class UnknownColumnKeyError extends Error {
  constructor(public readonly columnKey: string) {
    super(`Unknown or inaccessible column: ${columnKey}`);
    this.name = 'UnknownColumnKeyError';
  }
}

export interface AgentColumn {
  id: string;
  key: string;
  label: string;
  type: ColumnType;
  order: number;
  access: unknown;
}

/**
 * Fetches the caller's accessible TableColumn rows for a table — used both
 * to build the agent's system-prompt metadata (context diet, doc §2.3) and
 * to validate every columnKey a tool call references.
 *
 * @throws Error if the table doesn't exist.
 */
export async function getTableColumnsForAgent(tableId: string, userId: string): Promise<AgentColumn[]> {
  const { table, isOwner, role } = await getTableAccessContext(tableId, userId);

  const columns = await prisma.tableColumn.findMany({
    where: { tableId: table.id },
    select: { id: true, key: true, label: true, type: true, order: true, access: true },
    orderBy: { order: 'asc' },
  });

  return filterAccessibleColumns(columns, userId, isOwner, role) as AgentColumn[];
}

function unwrapCellValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value: unknown }).value;
  }
  return null;
}

function buildFilterWhere(filter: GridFilter, tableColumnId: string): Prisma.TableCellWhereInput {
  const base = { tableColumnId };

  switch (filter.operator) {
    case 'isEmpty':
      return { ...base, OR: [{ value: { equals: { value: null } } }] };
    case 'isNotEmpty':
      return { ...base, NOT: { value: { equals: { value: null } } } };
    case 'eq':
      return { ...base, value: { equals: { value: filter.value } } };
    case 'neq':
      return { ...base, NOT: { value: { equals: { value: filter.value } } } };
    case 'gt':
      return { ...base, value: { path: ['value'], gt: filter.value } };
    case 'gte':
      return { ...base, value: { path: ['value'], gte: filter.value } };
    case 'lt':
      return { ...base, value: { path: ['value'], lt: filter.value } };
    case 'lte':
      return { ...base, value: { path: ['value'], lte: filter.value } };
    case 'contains':
      return { ...base, value: { path: ['value'], string_contains: String(filter.value ?? '') } };
  }
}

/** Reads cells matching filter criteria, scoped to one table. Doc §4.2. */
export async function queryGridData(
  tableId: string,
  userId: string,
  args: QueryGridDataArgs
): Promise<QueryGridDataResult> {
  await getTableAccessContext(tableId, userId);
  const columns = await getTableColumnsForAgent(tableId, userId);
  const columnByKey = new Map(columns.map((c) => [c.key, c]));

  for (const filter of args.filters) {
    if (!columnByKey.has(filter.columnKey)) {
      throw new UnknownColumnKeyError(filter.columnKey);
    }
  }

  const tableMeta = await prisma.table.findUnique({
    where: { id: tableId },
    select: { representativeColumnKey: true, baseListId: true },
  });
  const representativeColumn = columnByKey.get(tableMeta?.representativeColumnKey ?? '');

  // Each filter narrows down a set of matching rowKeys (cells on that column
  // satisfying the predicate); intersect across filters, then re-fetch full rows.
  let matchingRowKeys: Set<string> | null = null;
  for (const filter of args.filters) {
    const column = columnByKey.get(filter.columnKey)!;
    const where = buildFilterWhere(filter, column.id);
    const matches = await prisma.tableCell.findMany({
      where: { tableId, ...where },
      select: { rowKey: true },
    });
    const keys = new Set(matches.map((m) => m.rowKey));
    if (matchingRowKeys === null) {
      matchingRowKeys = keys;
    } else {
      const intersected = new Set<string>();
      for (const k of matchingRowKeys) {
        if (keys.has(k)) intersected.add(k);
      }
      matchingRowKeys = intersected;
    }
  }

  const cellWhere: Prisma.TableCellWhereInput = { tableId };
  if (matchingRowKeys !== null) {
    cellWhere.rowKey = { in: [...matchingRowKeys] };
  }

  const cells = await prisma.tableCell.findMany({
    where: cellWhere,
    select: { rowKey: true, value: true, tableColumn: { select: { key: true, id: true } } },
    orderBy: { rowKey: 'asc' },
  });

  const accessibleColumnIds = new Set(columns.map((c) => c.id));
  const rowsByKey = new Map<string, Record<string, unknown>>();
  for (const cell of cells) {
    if (!accessibleColumnIds.has(cell.tableColumn.id)) continue;
    const row = rowsByKey.get(cell.rowKey) ?? {};
    row[cell.tableColumn.key] = unwrapCellValue(cell.value);
    rowsByKey.set(cell.rowKey, row);
  }

  const limitedEntries = [...rowsByKey.entries()].slice(0, args.limit);

  // representativeColumnKey doesn't always name a TableColumn on this table —
  // for a BaseList-bound table it commonly names an identity field on the
  // BaseList's own schema instead (see schema-agent.ts's finalizeDraft). In
  // that case the label lives on ListEntity.values, keyed by entity id, and
  // TableCell.rowKey === ListEntity.id for BaseList-bound rows.
  let entityLabelByRowKey: Map<string, string> | null = null;
  if (!representativeColumn && tableMeta?.baseListId && tableMeta.representativeColumnKey) {
    const entities = await prisma.listEntity.findMany({
      where: { baseListId: tableMeta.baseListId, id: { in: limitedEntries.map(([rowKey]) => rowKey) } },
      select: { id: true, values: true },
    });
    entityLabelByRowKey = new Map(
      entities.map((entity) => {
        const values = entity.values as Record<string, unknown>;
        const label = values[tableMeta.representativeColumnKey];
        return [entity.id, label !== undefined && label !== null ? String(label) : entity.id];
      })
    );
  }

  const rows = limitedEntries.map(([rowKey, cellValues]) => ({
    rowKey,
    representativeLabel: representativeColumn
      ? String(cellValues[representativeColumn.key] ?? rowKey)
      : (entityLabelByRowKey?.get(rowKey) ?? rowKey),
    cells: cellValues,
  }));

  return { rows };
}

/** Aggregate stats for a table: row count, per-NUMBER-column min/max/avg, empty-cell counts. Doc §4.2. */
export async function getGridSummary(tableId: string, userId: string): Promise<GetGridSummaryResult> {
  await getTableAccessContext(tableId, userId);
  const columns = await getTableColumnsForAgent(tableId, userId);
  const accessibleColumnIds = new Map(columns.map((c) => [c.id, c]));

  const cells = await prisma.tableCell.findMany({
    where: { tableId, tableColumnId: { in: [...accessibleColumnIds.keys()] } },
    select: { rowKey: true, value: true, tableColumnId: true },
  });

  const rowKeys = new Set(cells.map((c) => c.rowKey));

  const summaryColumns = columns.map((column) => {
    const columnCells = cells.filter((c) => c.tableColumnId === column.id);
    const values = columnCells.map((c) => unwrapCellValue(c.value));
    const filled = values.filter((v) => v !== null && v !== undefined).length;
    const empty = columnCells.length - filled;

    const stat: GetGridSummaryResult['columns'][number] = {
      key: column.key,
      type: column.type,
      filled,
      empty,
    };

    if (column.type === ColumnType.NUMBER) {
      const numbers = values.filter((v): v is number => typeof v === 'number');
      if (numbers.length > 0) {
        stat.min = Math.min(...numbers);
        stat.max = Math.max(...numbers);
        stat.avg = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
      }
    }

    return stat;
  });

  return { rowCount: rowKeys.size, columns: summaryColumns };
}

/**
 * Post-confirmation write executor. Never called mid-conversation by the
 * agent loop — only by `POST /api/ai/grid-agent/execute` after the user
 * has approved the previewed diff. Doc §4.2–4.3.
 */
export async function executeUpdateCellsBatch(
  tableId: string,
  userId: string,
  updates: CellUpdate[]
): Promise<UpdateCellsBatchResult> {
  const { table, isOwner, role } = await getTableAccessContext(tableId, userId);

  const columns = await prisma.tableColumn.findMany({
    where: { tableId: table.id },
    select: { id: true, key: true, type: true, access: true, validation: true },
  });
  const columnByKey = new Map(columns.map((c) => [c.key, c]));

  const failed: UpdateCellsBatchResult['failed'] = [];
  const resolvedWrites: Array<{ rowKey: string; tableColumnId: string; value: string | number | boolean | null }> = [];

  for (const update of updates) {
    const column = columnByKey.get(update.columnKey);
    if (!column) {
      failed.push({ rowKey: update.rowKey, columnKey: update.columnKey, reason: 'Unknown column' });
      continue;
    }
    if (!canAccessColumn(column, userId, isOwner, role)) {
      failed.push({ rowKey: update.rowKey, columnKey: update.columnKey, reason: 'Forbidden' });
      continue;
    }

    // Route the LLM-proposed value through the same schema-driven parser the
    // voice pipeline uses before validating — the agent is never told the
    // exact BOOLEAN/DATE/NUMBER vocabulary (docs/features/03_ai_table_agent.md
    // §4.2), so a value like "here" or "yes" must be normalized to `true`
    // rather than rejected outright as "Must be yes/no".
    // Prisma types `validation` as Json — its shape is enforced at the app layer, not the DB.
    const parsed = parseForColumn(
      update.value,
      { type: column.type as ColumnType, validation: column.validation as ColumnValidation | undefined },
      { language: 'auto' }
    );
    if (!parsed.valid) {
      failed.push({
        rowKey: update.rowKey,
        columnKey: update.columnKey,
        reason: parsed.error ?? 'Invalid value',
      });
      continue;
    }

    const validation = validateValue(parsed.value, column.type, column.validation as ColumnValidation | undefined);
    if (!validation.valid) {
      failed.push({
        rowKey: update.rowKey,
        columnKey: update.columnKey,
        reason: validation.error ?? 'Invalid value',
      });
      continue;
    }

    resolvedWrites.push({
      rowKey: update.rowKey,
      tableColumnId: column.id,
      value: parsed.value as string | number | boolean | null,
    });
  }

  if (resolvedWrites.length > 0) {
    await upsertCellsBatch({
      tableId,
      userId,
      writes: resolvedWrites,
      entrySource: EntrySource.MANUAL,
    });
  }

  return { updated: resolvedWrites.length, failed };
}
