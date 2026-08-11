import { describe, it, expect } from 'vitest';
import { deriveTableColumns, deriveTableRows, type TableWithRelationsDTO } from './table-schema-derivation';
import { ColumnType } from '@/lib/shared/types/column-types';

function baseTable(overrides: Partial<TableWithRelationsDTO> = {}): TableWithRelationsDTO {
  return {
    id: 't1',
    name: 'Table 1',
    description: null,
    baseListId: 'bl1',
    representativeColumnKey: 'name',
    schema: { columns: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    columns: [],
    ...overrides,
  };
}

describe('deriveTableColumns', () => {
  it('prefers table.schema.columns when present, flagging base columns from baseList.schema', () => {
    const table = baseTable({
      schema: {
        columns: [
          { id: 'name', label: 'Name', type: ColumnType.TEXT },
          { id: 'grade', label: 'Grade', type: ColumnType.NUMBER },
        ],
      },
      baseList: {
        id: 'bl1',
        name: 'Class A1',
        description: null,
        schema: { columns: [{ id: 'name', label: 'Name', type: ColumnType.TEXT }] },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        entities: [],
      },
    });

    const columns = deriveTableColumns(table);

    expect(columns).toEqual([
      { id: 'name', label: 'Name', type: ColumnType.TEXT, isBaseColumn: true, formula: undefined },
      { id: 'grade', label: 'Grade', type: ColumnType.NUMBER, isBaseColumn: false, formula: undefined },
    ]);
  });

  it('falls back to baseList.schema + relational table.columns when schema.columns is empty', () => {
    const table = baseTable({
      schema: { columns: [] },
      baseList: {
        id: 'bl1',
        name: 'Class A1',
        description: null,
        schema: { columns: [{ id: 'name', label: 'Name', type: ColumnType.TEXT }] },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        entities: [],
      },
      columns: [
        {
          id: 'grade',
          tableId: 't1',
          key: 'grade',
          label: 'Grade',
          type: 'NUMBER',
          order: 0,
          validation: null,
          access: null,
          formula: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const columns = deriveTableColumns(table);

    expect(columns).toHaveLength(2);
    expect(columns[0]).toMatchObject({ id: 'name', isBaseColumn: true });
    expect(columns[1]).toMatchObject({ id: 'grade', isBaseColumn: false, type: ColumnType.NUMBER });
  });

  it('returns an empty array for a null table', () => {
    expect(deriveTableColumns(null)).toEqual([]);
  });
});

describe('deriveTableRows', () => {
  it('labels rows using the representative column, falling back to the first text base column', () => {
    const table = baseTable({
      representativeColumnKey: 'name',
      baseList: {
        id: 'bl1',
        name: 'Class A1',
        description: null,
        schema: { columns: [] },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        entities: [
          { id: 'e1', baseListId: 'bl1', values: { name: 'Alice' }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      },
    });
    const columns = [{ id: 'name', label: 'Name', type: ColumnType.TEXT, isBaseColumn: true }];

    const rows = deriveTableRows(table, columns);

    expect(rows).toEqual([{ id: 'e1', label: 'Alice', values: { name: 'Alice' } }]);
  });

  it('returns an empty array for a null table', () => {
    expect(deriveTableRows(null, [])).toEqual([]);
  });
});
