import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';

const tableFindUnique = vi.fn();
const tableColumnFindMany = vi.fn();
const tableCellFindMany = vi.fn();
const organizationMemberFindUnique = vi.fn();
const listEntityFindMany = vi.fn();
const upsertCellsBatchMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    table: { findUnique: (...args: unknown[]) => tableFindUnique(...args) },
    tableColumn: { findMany: (...args: unknown[]) => tableColumnFindMany(...args) },
    tableCell: { findMany: (...args: unknown[]) => tableCellFindMany(...args) },
    organizationMember: { findUnique: (...args: unknown[]) => organizationMemberFindUnique(...args) },
    listEntity: { findMany: (...args: unknown[]) => listEntityFindMany(...args) },
  },
}));

vi.mock('@/lib/server/services/cells', () => ({
  upsertCellsBatch: (...args: unknown[]) => upsertCellsBatchMock(...args),
}));

import {
  getTableColumnsForAgent,
  queryGridData,
  getGridSummary,
  executeUpdateCellsBatch,
  UnknownColumnKeyError,
} from './ai-grid-tools';

const OWNER_ID = 'user-owner';
const TABLE_ID = 'table-1';

function ownedTable(overrides: Partial<{ userId: string; organizationId: string | null }> = {}) {
  return { id: TABLE_ID, userId: OWNER_ID, organizationId: null, representativeColumnKey: 'name', ...overrides };
}

const nameColumn = { id: 'col-name', tableId: TABLE_ID, key: 'name', label: 'Name', type: ColumnType.TEXT, order: 0, access: null };
const scoreColumn = { id: 'col-score', tableId: TABLE_ID, key: 'score', label: 'Score', type: ColumnType.NUMBER, order: 1, access: null };

beforeEach(() => {
  tableFindUnique.mockReset();
  tableColumnFindMany.mockReset();
  tableCellFindMany.mockReset();
  organizationMemberFindUnique.mockReset();
  listEntityFindMany.mockReset();
  upsertCellsBatchMock.mockReset();
});

describe('getTableColumnsForAgent', () => {
  it('returns owner-accessible columns', async () => {
    tableFindUnique.mockResolvedValue(ownedTable());
    tableColumnFindMany.mockResolvedValue([nameColumn, scoreColumn]);

    const columns = await getTableColumnsForAgent(TABLE_ID, OWNER_ID);

    expect(columns).toHaveLength(2);
    expect(columns.map((c) => c.key)).toEqual(['name', 'score']);
  });

  it('throws when the table does not exist', async () => {
    tableFindUnique.mockResolvedValue(null);

    await expect(getTableColumnsForAgent(TABLE_ID, OWNER_ID)).rejects.toThrow(/not found/);
  });
});

describe('queryGridData', () => {
  it('throws UnknownColumnKeyError for a filter on a nonexistent column', async () => {
    tableFindUnique.mockResolvedValue(ownedTable());
    tableColumnFindMany.mockResolvedValue([nameColumn, scoreColumn]);

    await expect(
      queryGridData(TABLE_ID, OWNER_ID, { filters: [{ columnKey: 'ghost', operator: 'eq', value: 1 }], limit: 50 })
    ).rejects.toThrow(UnknownColumnKeyError);
  });

  it('assembles rows with representativeLabel from the representative column', async () => {
    tableFindUnique.mockResolvedValue(ownedTable());
    tableColumnFindMany.mockResolvedValue([nameColumn, scoreColumn]);

    tableCellFindMany.mockResolvedValue([
      { rowKey: 'row-1', value: { value: 'Dan Cohen' }, tableColumn: { key: 'name', id: 'col-name' } },
      { rowKey: 'row-1', value: { value: 85 }, tableColumn: { key: 'score', id: 'col-score' } },
    ]);

    const result = await queryGridData(TABLE_ID, OWNER_ID, { filters: [], limit: 50 });

    expect(result.rows).toEqual([
      { rowKey: 'row-1', representativeLabel: 'Dan Cohen', cells: { name: 'Dan Cohen', score: 85 } },
    ]);
  });

  it('resolves representativeLabel from the linked BaseList entity when representativeColumnKey is not a TableColumn', async () => {
    // Only "score" is a TableColumn on this table — representativeColumnKey
    // points at the BaseList's own identity field instead (doc §3.3 finalizeDraft).
    tableFindUnique.mockResolvedValue({
      ...ownedTable(),
      representativeColumnKey: 'student_name',
      baseListId: 'baselist-1',
    });
    tableColumnFindMany.mockResolvedValue([scoreColumn]);
    tableCellFindMany.mockResolvedValue([
      { rowKey: 'entity-1', value: { value: 85 }, tableColumn: { key: 'score', id: 'col-score' } },
    ]);
    listEntityFindMany.mockResolvedValue([
      { id: 'entity-1', values: { student_name: 'Dan Cohen' } },
    ]);

    const result = await queryGridData(TABLE_ID, OWNER_ID, { filters: [], limit: 50 });

    expect(result.rows).toEqual([
      { rowKey: 'entity-1', representativeLabel: 'Dan Cohen', cells: { score: 85 } },
    ]);
    expect(listEntityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { baseListId: 'baselist-1', id: { in: ['entity-1'] } } })
    );
  });

  it('falls back to the raw rowKey when no BaseList entity or TableColumn resolves the representative key', async () => {
    tableFindUnique.mockResolvedValue({ ...ownedTable(), representativeColumnKey: 'student_name', baseListId: null });
    tableColumnFindMany.mockResolvedValue([scoreColumn]);
    tableCellFindMany.mockResolvedValue([
      { rowKey: 'row-1', value: { value: 85 }, tableColumn: { key: 'score', id: 'col-score' } },
    ]);

    const result = await queryGridData(TABLE_ID, OWNER_ID, { filters: [], limit: 50 });

    expect(result.rows).toEqual([{ rowKey: 'row-1', representativeLabel: 'row-1', cells: { score: 85 } }]);
    expect(listEntityFindMany).not.toHaveBeenCalled();
  });
});

describe('getGridSummary', () => {
  it('computes rowCount, filled/empty, and NUMBER min/max/avg', async () => {
    tableFindUnique.mockResolvedValue(ownedTable());
    tableColumnFindMany.mockResolvedValue([nameColumn, scoreColumn]);
    tableCellFindMany.mockResolvedValue([
      { rowKey: 'row-1', value: { value: 'Dan' }, tableColumnId: 'col-name' },
      { rowKey: 'row-2', value: { value: null }, tableColumnId: 'col-name' },
      { rowKey: 'row-1', value: { value: 80 }, tableColumnId: 'col-score' },
      { rowKey: 'row-2', value: { value: 100 }, tableColumnId: 'col-score' },
    ]);

    const result = await getGridSummary(TABLE_ID, OWNER_ID);

    expect(result.rowCount).toBe(2);
    const scoreStat = result.columns.find((c) => c.key === 'score');
    expect(scoreStat).toMatchObject({ filled: 2, empty: 0, min: 80, max: 100, avg: 90 });
    const nameStat = result.columns.find((c) => c.key === 'name');
    expect(nameStat).toMatchObject({ filled: 1, empty: 1 });
  });
});

describe('executeUpdateCellsBatch', () => {
  it('delegates resolvable writes to upsertCellsBatch with entrySource MANUAL', async () => {
    tableFindUnique.mockResolvedValue(ownedTable());
    tableColumnFindMany.mockResolvedValue([
      { id: 'col-score', key: 'score', type: ColumnType.NUMBER, access: null, validation: null },
    ]);
    upsertCellsBatchMock.mockResolvedValue([]);

    const result = await executeUpdateCellsBatch(TABLE_ID, OWNER_ID, [
      { rowKey: 'row-1', columnKey: 'score', value: 85 },
    ]);

    expect(result).toEqual({ updated: 1, failed: [] });
    expect(upsertCellsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: TABLE_ID,
        userId: OWNER_ID,
        writes: [{ rowKey: 'row-1', tableColumnId: 'col-score', value: 85 }],
        entrySource: 'MANUAL',
      })
    );
  });

  it('partitions unknown-column and invalid-value updates into failed[], never calling upsertCellsBatch for them', async () => {
    tableFindUnique.mockResolvedValue(ownedTable());
    tableColumnFindMany.mockResolvedValue([
      { id: 'col-score', key: 'score', type: ColumnType.NUMBER, access: null, validation: null },
    ]);
    upsertCellsBatchMock.mockResolvedValue([]);

    const result = await executeUpdateCellsBatch(TABLE_ID, OWNER_ID, [
      { rowKey: 'row-1', columnKey: 'ghost', value: 1 },
      { rowKey: 'row-2', columnKey: 'score', value: 'not-a-number' },
    ]);

    expect(result.updated).toBe(0);
    expect(result.failed).toEqual([
      { rowKey: 'row-1', columnKey: 'ghost', reason: 'Unknown column' },
      { rowKey: 'row-2', columnKey: 'score', reason: 'Must be a number' },
    ]);
    expect(upsertCellsBatchMock).not.toHaveBeenCalled();
  });
});
