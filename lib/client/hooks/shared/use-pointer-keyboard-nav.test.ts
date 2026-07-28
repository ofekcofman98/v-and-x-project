import { describe, it, expect } from 'vitest';
import { resolveKeyboardNavigation } from './use-pointer-keyboard-nav';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import { ColumnType } from '@/lib/shared/types/column-types';

const schema: TableSchema = {
  rows: [
    { id: 'row0', label: 'Row 0' },
    { id: 'row1', label: 'Row 1' },
  ],
  columns: [
    { id: 'col0', label: 'Col 0', type: ColumnType.TEXT },
    { id: 'col1', label: 'Col 1', type: ColumnType.TEXT },
  ],
};

const rowIndexMap = new Map(schema.rows.map((row, index) => [row.id, index]));
const colIndexMap = new Map(schema.columns.map((col, index) => [col.id, index]));

describe('resolveKeyboardNavigation', () => {
  it('Tab advances following row-first navigationMode', () => {
    const next = resolveKeyboardNavigation(
      'Tab',
      false,
      { rowKey: 'row0', tableColumnId: 'col0' },
      schema,
      'row-first',
      rowIndexMap,
      colIndexMap
    );
    expect(next).toEqual({ rowKey: 'row0', tableColumnId: 'col1' });
  });

  it('Tab advances following column-first navigationMode', () => {
    const next = resolveKeyboardNavigation(
      'Tab',
      false,
      { rowKey: 'row0', tableColumnId: 'col0' },
      schema,
      'column-first',
      rowIndexMap,
      colIndexMap
    );
    expect(next).toEqual({ rowKey: 'row1', tableColumnId: 'col0' });
  });

  it('Shift+Tab retreats', () => {
    const prev = resolveKeyboardNavigation(
      'Tab',
      true,
      { rowKey: 'row0', tableColumnId: 'col1' },
      schema,
      'row-first',
      rowIndexMap,
      colIndexMap
    );
    expect(prev).toEqual({ rowKey: 'row0', tableColumnId: 'col0' });
  });

  it('ArrowRight moves spatially regardless of navigationMode', () => {
    const next = resolveKeyboardNavigation(
      'ArrowRight',
      false,
      { rowKey: 'row0', tableColumnId: 'col0' },
      schema,
      'column-first',
      rowIndexMap,
      colIndexMap
    );
    expect(next).toEqual({ rowKey: 'row0', tableColumnId: 'col1' });
  });

  it('ArrowDown moves spatially regardless of navigationMode', () => {
    const next = resolveKeyboardNavigation(
      'ArrowDown',
      false,
      { rowKey: 'row0', tableColumnId: 'col0' },
      schema,
      'row-first',
      rowIndexMap,
      colIndexMap
    );
    expect(next).toEqual({ rowKey: 'row1', tableColumnId: 'col0' });
  });

  it('ArrowUp returns null at the top row (no wrap)', () => {
    const next = resolveKeyboardNavigation(
      'ArrowUp',
      false,
      { rowKey: 'row0', tableColumnId: 'col0' },
      schema,
      'row-first',
      rowIndexMap,
      colIndexMap
    );
    expect(next).toBeNull();
  });

  it('ArrowLeft returns null at the first column (no wrap)', () => {
    const next = resolveKeyboardNavigation(
      'ArrowLeft',
      false,
      { rowKey: 'row0', tableColumnId: 'col0' },
      schema,
      'row-first',
      rowIndexMap,
      colIndexMap
    );
    expect(next).toBeNull();
  });

  it('returns null for an unhandled key', () => {
    const next = resolveKeyboardNavigation(
      'Enter',
      false,
      { rowKey: 'row0', tableColumnId: 'col0' },
      schema,
      'row-first',
      rowIndexMap,
      colIndexMap
    );
    expect(next).toBeNull();
  });
});
