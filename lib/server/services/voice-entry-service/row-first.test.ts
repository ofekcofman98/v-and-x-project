import { describe, it, expect } from 'vitest';
import { resolveFirstEditableColumnId, isRowFirstMidRow } from './row-first';

describe('resolveFirstEditableColumnId', () => {
  it('skips a leading base column and returns the first editable one', () => {
    const columns = [
      { id: 'entity', isBaseColumn: true },
      { id: 'math', isBaseColumn: false },
      { id: 'english', isBaseColumn: false },
    ];
    expect(resolveFirstEditableColumnId(columns)).toBe('math');
  });

  it('skips interspersed base columns, not just leading ones', () => {
    const columns = [
      { id: 'entity', isBaseColumn: true },
      { id: 'id_number', isBaseColumn: true },
      { id: 'math', isBaseColumn: false },
    ];
    expect(resolveFirstEditableColumnId(columns)).toBe('math');
  });

  it('returns the first column id when no column is marked as base', () => {
    const columns = [
      { id: 'math', isBaseColumn: undefined },
      { id: 'english', isBaseColumn: false },
    ];
    expect(resolveFirstEditableColumnId(columns)).toBe('math');
  });

  it('returns null when every column is a base column', () => {
    const columns = [{ id: 'entity', isBaseColumn: true }];
    expect(resolveFirstEditableColumnId(columns)).toBeNull();
  });
});

describe('isRowFirstMidRow', () => {
  const tableSchema = {
    columns: [
      { id: 'entity', isBaseColumn: true },
      { id: 'math', isBaseColumn: false },
      { id: 'english', isBaseColumn: false },
    ],
  };

  it('is false for column-first regardless of which column is active', () => {
    expect(isRowFirstMidRow('column-first', { tableColumnId: 'english' }, tableSchema)).toBe(false);
  });

  it('is false for row-first on the first editable column', () => {
    expect(isRowFirstMidRow('row-first', { tableColumnId: 'math' }, tableSchema)).toBe(false);
  });

  it('is true for row-first on a later column in the same row', () => {
    expect(isRowFirstMidRow('row-first', { tableColumnId: 'english' }, tableSchema)).toBe(true);
  });

  it('is true for row-first when the active cell is the (never-clickable) base column, since it is not the first editable column', () => {
    expect(isRowFirstMidRow('row-first', { tableColumnId: 'entity' }, tableSchema)).toBe(true);
  });
});
