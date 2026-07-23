import type { ColumnDefinition } from '@/lib/shared/types/table-schema';

// ─────────────────────────────────────────────────────────────────────────────
// Row-first mid-row detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The first column a user actually enters data into for a row — skips any
 * leading (or interspersed) base-list columns, which are always read-only
 * (docs/04_DATABASE.md; DataTable.tsx's `isReadOnly || column.isBaseColumn`
 * guard) and therefore never a real activeCell target.
 * Exported for unit testing.
 */
export function resolveFirstEditableColumnId(
  columns: Pick<ColumnDefinition, 'id' | 'isBaseColumn'>[]
): string | null {
  return columns.find((c) => c.isBaseColumn !== true)?.id ?? null;
}

/**
 * True once the pointer is past a row's first editable column in Row-first
 * mode — at that point the row is already established and every subsequent
 * utterance is deterministically a value for the current column, with no
 * entity to resolve. Column-first is unaffected: each entry there is
 * naturally for a different row, so entity resolution still applies.
 * Exported for unit testing.
 */
export function isRowFirstMidRow(
  navigationMode: 'column-first' | 'row-first',
  activeCell: { tableColumnId: string },
  tableSchema: { columns: Pick<ColumnDefinition, 'id' | 'isBaseColumn'>[] }
): boolean {
  if (navigationMode !== 'row-first') return false;
  const firstEditableId = resolveFirstEditableColumnId(tableSchema.columns);
  return firstEditableId !== null && activeCell.tableColumnId !== firstEditableId;
}
