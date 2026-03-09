/**
 * Column Type Definitions and Cell Formatters
 * Single source of truth for column types and their formatting logic
 * Based on: docs/03_DATABASE.md §4.1
 */

/**
 * Column types supported by VocalGrid tables
 */
export enum ColumnType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
}

/**
 * Cell value formatter function signature
 */
type CellFormatter = (value: string | number | boolean) => string;

/**
 * Type-safe formatter map
 * Add new column types by extending this map
 */
export const CELL_FORMATTERS: Record<ColumnType, CellFormatter> = {
  [ColumnType.TEXT]: (value) => String(value),
  
  [ColumnType.NUMBER]: (value) => 
    typeof value === 'number' ? value.toString() : String(value),
  
  [ColumnType.BOOLEAN]: (value) => 
    value ? '✓' : '✗',
  
  [ColumnType.DATE]: (value) => {
    if (typeof value === 'string') {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    }
    return String(value);
  },
} as const;

/**
 * Format a cell value based on its column type
 * @param value - The raw cell value
 * @param type - The column type
 * @returns Formatted string for display
 */
export function formatCellValue(
  value: string | number | boolean | null | undefined,
  type: ColumnType
): string {
  if (value === null || value === undefined) return '';
  
  const formatter = CELL_FORMATTERS[type] ?? CELL_FORMATTERS[ColumnType.TEXT];
  return formatter(value);
}
