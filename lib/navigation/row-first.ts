/**
 * Row-First Navigation
 * Based on: docs/06_SMART_POINTER.md §3.2
 * 
 * Pattern: Fill one row across all columns, then move to next row
 * 
 * Example:
 * Start: (row0, col0)
 * Next:  (row0, col1)
 * Next:  (row0, col2)
 * ...
 * Next:  (row0, colN) → end of row
 * Next:  (row1, col0) → wrap to next row
 */

import { TableSchema } from '@/lib/types/table-schema';

export interface ActiveCell {
  rowId: string;
  columnId: string;
}

/**
 * Get the next cell in row-first navigation mode
 */
export function getNextCellRowFirst(
  currentCell: ActiveCell,
  schema: TableSchema
): ActiveCell | null {
  const { rowId, columnId } = currentCell;
  
  const currentRowIndex = schema.rows.findIndex((r) => r.id === rowId);
  const currentColIndex = schema.columns.findIndex((c) => c.id === columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    console.error('Current cell not found in schema');
    return null;
  }
  
  // Try to move right (same row, next column)
  const nextColIndex = currentColIndex + 1;
  
  if (nextColIndex < schema.columns.length) {
    // Move to next column
    return {
      rowId: rowId,
      columnId: schema.columns[nextColIndex].id,
    };
  }
  
  // End of row, try to move to next row
  const nextRowIndex = currentRowIndex + 1;
  
  if (nextRowIndex < schema.rows.length) {
    // Move to first column of next row
    return {
      rowId: schema.rows[nextRowIndex].id,
      columnId: schema.columns[0].id,
    };
  }
  
  // End of table
  return null;
}

/**
 * Get the previous cell in row-first navigation mode
 */
export function getPreviousCellRowFirst(
  currentCell: ActiveCell,
  schema: TableSchema
): ActiveCell | null {
  const { rowId, columnId } = currentCell;
  
  const currentRowIndex = schema.rows.findIndex((r) => r.id === rowId);
  const currentColIndex = schema.columns.findIndex((c) => c.id === columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    return null;
  }
  
  // Try to move left (same row, previous column)
  const prevColIndex = currentColIndex - 1;
  
  if (prevColIndex >= 0) {
    return {
      rowId: rowId,
      columnId: schema.columns[prevColIndex].id,
    };
  }
  
  // Beginning of row, try to move to previous row
  const prevRowIndex = currentRowIndex - 1;
  
  if (prevRowIndex >= 0) {
    // Move to last column of previous row
    return {
      rowId: schema.rows[prevRowIndex].id,
      columnId: schema.columns[schema.columns.length - 1].id,
    };
  }
  
  // Beginning of table
  return null;
}
