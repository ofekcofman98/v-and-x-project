/**
 * Column Type Definitions and Cell Formatters
 * Single source of truth for column types and their formatting logic
 * Based on: docs/03_DATABASE.md §4.1
 */

import { parseBoolean } from '@/lib/shared/parsers/boolean-parser';

/**
 * Column types supported by VocalGrid tables
 */
export enum ColumnType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  COMPUTED = 'COMPUTED',
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
  
  [ColumnType.BOOLEAN]: (value) => {
    // Shares the bilingual vocabulary with the write path (parseBoolean /
    // coerceCellValue) instead of truthiness-testing — a legacy string
    // value like "no" must render '✗', not '✓' just because it's non-empty.
    const parsed = typeof value === 'boolean' ? value : parseBoolean(String(value));
    // Unrecognized legacy strings render blank; formatCellValue's caller
    // falls back to the em-dash rather than asserting a wrong ✓/✗.
    return parsed === null ? '' : parsed ? '✓' : '✗';
  },
  
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

  // Computed columns render via formatFormulaResult (lib/shared/utils/formula.ts);
  // this entry exists only to keep CELL_FORMATTERS total over ColumnType.
  [ColumnType.COMPUTED]: (value) =>
    typeof value === 'number' ? value.toString() : String(value),
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
