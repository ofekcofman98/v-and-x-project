import { describe, it, expect } from 'vitest';
import { navigationStrategies } from './strategies';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import { ColumnType } from '@/lib/shared/types/column-types';

const schema: TableSchema = {
  rows: [
    { id: 'row0', label: 'Row 0' },
    { id: 'row1', label: 'Row 1' },
    { id: 'row2', label: 'Row 2' },
  ],
  columns: [
    { id: 'col0', label: 'Col 0', type: ColumnType.TEXT },
    { id: 'col1', label: 'Col 1', type: ColumnType.TEXT },
    { id: 'col2', label: 'Col 2', type: ColumnType.TEXT },
  ],
};

const rowIndexMap = new Map(schema.rows.map((row, index) => [row.id, index]));
const colIndexMap = new Map(schema.columns.map((col, index) => [col.id, index]));

describe('rowFirstStrategy', () => {
  const strategy = navigationStrategies['row-first'];

  it('steps right within a row', () => {
    const next = strategy.getNext({ rowKey: 'row0', tableColumnId: 'col0' }, schema, rowIndexMap, colIndexMap);
    expect(next).toEqual({ rowKey: 'row0', tableColumnId: 'col1' });
  });

  it('wraps to column 0 of the next row at the end of a row', () => {
    const next = strategy.getNext({ rowKey: 'row0', tableColumnId: 'col2' }, schema, rowIndexMap, colIndexMap);
    expect(next).toEqual({ rowKey: 'row1', tableColumnId: 'col0' });
  });

  it('returns null at the last cell of the table', () => {
    const next = strategy.getNext({ rowKey: 'row2', tableColumnId: 'col2' }, schema, rowIndexMap, colIndexMap);
    expect(next).toBeNull();
  });

  it('steps left within a row for getPrevious', () => {
    const prev = strategy.getPrevious({ rowKey: 'row0', tableColumnId: 'col1' }, schema, rowIndexMap, colIndexMap);
    expect(prev).toEqual({ rowKey: 'row0', tableColumnId: 'col0' });
  });

  it('wraps to the last column of the previous row for getPrevious', () => {
    const prev = strategy.getPrevious({ rowKey: 'row1', tableColumnId: 'col0' }, schema, rowIndexMap, colIndexMap);
    expect(prev).toEqual({ rowKey: 'row0', tableColumnId: 'col2' });
  });

  it('returns null at the first cell of the table for getPrevious', () => {
    const prev = strategy.getPrevious({ rowKey: 'row0', tableColumnId: 'col0' }, schema, rowIndexMap, colIndexMap);
    expect(prev).toBeNull();
  });
});

describe('columnFirstStrategy', () => {
  const strategy = navigationStrategies['column-first'];

  it('steps down within a column', () => {
    const next = strategy.getNext({ rowKey: 'row0', tableColumnId: 'col0' }, schema, rowIndexMap, colIndexMap);
    expect(next).toEqual({ rowKey: 'row1', tableColumnId: 'col0' });
  });

  it('wraps to row 0 of the next column at the end of a column', () => {
    const next = strategy.getNext({ rowKey: 'row2', tableColumnId: 'col0' }, schema, rowIndexMap, colIndexMap);
    expect(next).toEqual({ rowKey: 'row0', tableColumnId: 'col1' });
  });

  it('returns null at the last cell of the table', () => {
    const next = strategy.getNext({ rowKey: 'row2', tableColumnId: 'col2' }, schema, rowIndexMap, colIndexMap);
    expect(next).toBeNull();
  });

  it('steps up within a column for getPrevious', () => {
    const prev = strategy.getPrevious({ rowKey: 'row1', tableColumnId: 'col0' }, schema, rowIndexMap, colIndexMap);
    expect(prev).toEqual({ rowKey: 'row0', tableColumnId: 'col0' });
  });

  it('wraps to the last row of the previous column for getPrevious', () => {
    const prev = strategy.getPrevious({ rowKey: 'row0', tableColumnId: 'col1' }, schema, rowIndexMap, colIndexMap);
    expect(prev).toEqual({ rowKey: 'row2', tableColumnId: 'col0' });
  });

  it('returns null at the first cell of the table for getPrevious', () => {
    const prev = strategy.getPrevious({ rowKey: 'row0', tableColumnId: 'col0' }, schema, rowIndexMap, colIndexMap);
    expect(prev).toBeNull();
  });
});
