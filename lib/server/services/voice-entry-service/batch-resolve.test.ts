import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { TableSchema } from '@/lib/shared/types/table-schema';

const matchAsyncMock = vi.fn();

vi.mock('@/lib/server/matching/matcher', () => ({
  matchAsync: (...args: unknown[]) => matchAsyncMock(...args),
}));

import { resolveColumnFirstEntry, resolveRowFirstEntry, resolveEntityFirstGroup } from './batch-resolve';

const ctx = { language: 'en' as const };

const tableSchema: TableSchema = {
  columns: [
    { id: 'entity', label: 'Name', type: ColumnType.TEXT, isBaseColumn: true },
    { id: 'math', label: 'Math', type: ColumnType.NUMBER },
  ],
  rows: [
    { id: 'row-dan', label: 'Dan Cohen' },
    { id: 'row-noa', label: 'Noa Levi' },
  ],
};

const activeColumn = tableSchema.columns[1];

beforeEach(() => {
  matchAsyncMock.mockReset();
});

describe('resolveColumnFirstEntry', () => {
  it('routes to auto on a high-confidence unique match', async () => {
    matchAsyncMock.mockResolvedValue({ matched: 'Dan Cohen', confidence: 0.95, matchType: 'exact' });

    const result = await resolveColumnFirstEntry(
      { entityText: 'Dan', rawValue: '85' },
      tableSchema,
      activeColumn,
      'table-1',
      ctx
    );

    expect(result.confidenceRoute).toBe('auto');
    expect(result.rowKey).toBe('row-dan');
    expect(result.value).toBe(85);
    expect(result.valueValid).toBe(true);
  });

  it('routes to disambiguate on mid-range confidence', async () => {
    matchAsyncMock.mockResolvedValue({ matched: 'Dan Cohen', confidence: 0.7, matchType: 'fuzzy' });

    const result = await resolveColumnFirstEntry(
      { entityText: 'Dann', rawValue: '85' },
      tableSchema,
      activeColumn,
      'table-1',
      ctx
    );

    expect(result.confidenceRoute).toBe('disambiguate');
  });

  it('routes to disambiguate when there are 2+ close candidates even above the auto threshold', async () => {
    matchAsyncMock.mockResolvedValue({
      matched: 'Dan Cohen',
      confidence: 0.9,
      matchType: 'fuzzy',
      candidates: [
        { entity: 'Dan Cohen', score: 0.9 },
        { entity: 'Noa Levi', score: 0.88 },
      ],
    });

    const result = await resolveColumnFirstEntry(
      { entityText: 'Dan', rawValue: '85' },
      tableSchema,
      activeColumn,
      'table-1',
      ctx
    );

    expect(result.confidenceRoute).toBe('disambiguate');
    expect(result.candidates).toHaveLength(2);
  });

  it('routes to unresolved on a low-confidence match', async () => {
    matchAsyncMock.mockResolvedValue({ matched: null, confidence: 0.2, matchType: 'none' });

    const result = await resolveColumnFirstEntry(
      { entityText: 'Xyz', rawValue: '85' },
      tableSchema,
      activeColumn,
      'table-1',
      ctx
    );

    expect(result.confidenceRoute).toBe('unresolved');
    expect(result.rowKey).toBeNull();
  });

  it('routes to parse_error when the value fails to parse, preserving the entity match', async () => {
    matchAsyncMock.mockResolvedValue({ matched: 'Dan Cohen', confidence: 0.95, matchType: 'exact' });

    const result = await resolveColumnFirstEntry(
      { entityText: 'Dan', rawValue: 'not-a-number' },
      tableSchema,
      activeColumn,
      'table-1',
      ctx
    );

    expect(result.confidenceRoute).toBe('parse_error');
    expect(result.entity).toBe('Dan Cohen');
    expect(result.valueValid).toBe(false);
  });
});

describe('resolveRowFirstEntry', () => {
  const row = { id: 'row-dan', label: 'Dan Cohen' };

  it('routes to auto on a valid value, with no entity matching performed', () => {
    const result = resolveRowFirstEntry('85', activeColumn, row, ctx);

    expect(result.confidenceRoute).toBe('auto');
    expect(result.rowKey).toBe('row-dan');
    expect(result.value).toBe(85);
    expect(matchAsyncMock).not.toHaveBeenCalled();
  });

  it('routes to parse_error on an invalid value', () => {
    const result = resolveRowFirstEntry('not-a-number', activeColumn, row, ctx);

    expect(result.confidenceRoute).toBe('parse_error');
    expect(result.valueValid).toBe(false);
  });

  it('never returns disambiguate or unresolved', () => {
    const valid = resolveRowFirstEntry('85', activeColumn, row, ctx);
    const invalid = resolveRowFirstEntry('garbage', activeColumn, row, ctx);

    expect(['auto', 'parse_error']).toContain(valid.confidenceRoute);
    expect(['auto', 'parse_error']).toContain(invalid.confidenceRoute);
  });
});

describe('resolveEntityFirstGroup', () => {
  const multiColumnSchema: TableSchema = {
    columns: [
      { id: 'entity', label: 'Name', type: ColumnType.TEXT, isBaseColumn: true },
      { id: 'math', label: 'Math', type: ColumnType.NUMBER },
      { id: 'english', label: 'English', type: ColumnType.NUMBER },
      { id: 'science', label: 'Science', type: ColumnType.NUMBER },
    ],
    rows: [
      { id: 'row-dana', label: 'Dana' },
      { id: 'row-yossi', label: 'Yossi' },
    ],
  };

  it('matches the entity once and writes all values in column order, carrying real confidence', async () => {
    matchAsyncMock.mockResolvedValue({ matched: 'Dana', confidence: 0.95, matchType: 'exact' });

    const result = await resolveEntityFirstGroup(
      { entityText: 'Dana', rawValues: ['90', '85', '70'] },
      multiColumnSchema,
      { tableColumnId: 'math' },
      'table-1',
      ctx
    );

    expect(matchAsyncMock).toHaveBeenCalledTimes(1);
    expect(result.writes).toHaveLength(3);
    expect(result.writes.map((w) => w.tableColumnId)).toEqual(['math', 'english', 'science']);
    expect(result.writes.every((w) => w.rowKey === 'row-dana')).toBe(true);
    expect(result.writes.every((w) => w.confidenceRoute === 'auto')).toBe(true);
    expect(result.writes.every((w) => w.entityMatch?.confidence === 0.95)).toBe(true);
    expect(result.overflowCount).toBe(0);
  });

  it('reports overflowCount without spilling into another row when values exceed remaining columns', async () => {
    matchAsyncMock.mockResolvedValue({ matched: 'Dana', confidence: 0.95, matchType: 'exact' });

    const result = await resolveEntityFirstGroup(
      { entityText: 'Dana', rawValues: ['90', '85', '70', '60'] },
      multiColumnSchema,
      { tableColumnId: 'math' },
      'table-1',
      ctx
    );

    expect(result.writes).toHaveLength(3);
    expect(result.writes.every((w) => w.rowKey === 'row-dana')).toBe(true);
    expect(result.overflowCount).toBe(1);
  });

  it('leaves rowKey null and routes unresolved when the entity cannot be matched', async () => {
    matchAsyncMock.mockResolvedValue({ matched: null, confidence: 0.2, matchType: 'none' });

    const result = await resolveEntityFirstGroup(
      { entityText: 'Xyz', rawValues: ['90'] },
      multiColumnSchema,
      { tableColumnId: 'math' },
      'table-1',
      ctx
    );

    expect(result.writes[0].rowKey).toBeNull();
    expect(result.writes[0].confidenceRoute).toBe('unresolved');
  });
});
