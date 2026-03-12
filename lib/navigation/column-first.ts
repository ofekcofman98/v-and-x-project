/**
 * Column-First Navigation
 * Based on: docs/06_SMART_POINTER.md §3.1
 * 
 * Pattern: Fill one column across all rows, then move to next column
 * 
 * Example:
 * Start: (row0, col0)
 * Next:  (row1, col0)
 * Next:  (row2, col0)
 * ...
 * Next:  (rowN, col0) → end of column
 * Next:  (row0, col1) → wrap to next column
 */

import { TableSchema } from '@/lib/types/table-schema';

export interface ActiveCell {
  rowId: string;
  columnId: string;
}

/**
 * Get the next cell in column-first navigation mode
 */
export function getNextCellColumnFirst(
  currentCell: ActiveCell,
  schema: TableSchema
): ActiveCell | null {
  const { rowId, columnId } = currentCell;
  
  // Find current indices
  const currentRowIndex = schema.rows.findIndex((r) => r.id === rowId);
  const currentColIndex = schema.columns.findIndex((c) => c.id === columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    console.error('Current cell not found in schema');
    return null;
  }
  
  // Try to move down (next row, same column)
  const nextRowIndex = currentRowIndex + 1;
  
  if (nextRowIndex < schema.rows.length) {
    // Move to next row
    return {
      rowId: schema.rows[nextRowIndex].id,
      columnId: columnId,
    };
  }
  
  // End of column, try to move to next column
  const nextColIndex = currentColIndex + 1;
  
  if (nextColIndex < schema.columns.length) {
    // Move to first row of next column
    return {
      rowId: schema.rows[0].id,
      columnId: schema.columns[nextColIndex].id,
    };
  }
  
  // End of table
  return null;
}

/**
 * Get the previous cell in column-first navigation mode (for undo/backspace)
 */
export function getPreviousCellColumnFirst(
  currentCell: ActiveCell,
  schema: TableSchema
): ActiveCell | null {
  const { rowId, columnId } = currentCell;
  
  const currentRowIndex = schema.rows.findIndex((r) => r.id === rowId);
  const currentColIndex = schema.columns.findIndex((c) => c.id === columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    return null;
  }
  
  // Try to move up (previous row, same column)
  const prevRowIndex = currentRowIndex - 1;
  
  if (prevRowIndex >= 0) {
    return {
      rowId: schema.rows[prevRowIndex].id,
      columnId: columnId,
    };
  }
  
  // Beginning of column, try to move to previous column
  const prevColIndex = currentColIndex - 1;
  
  if (prevColIndex >= 0) {
    // Move to last row of previous column
    return {
      rowId: schema.rows[schema.rows.length - 1].id,
      columnId: schema.columns[prevColIndex].id,
    };
  }
  
  // Beginning of table
  return null;
}
