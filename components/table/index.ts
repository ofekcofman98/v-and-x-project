/**
 * Table Components Barrel Export
 */

export { DataTable } from './DataTable';
export { DataTableCell } from './DataTableCell';
export { MobileTableView } from './MobileTableView';

export type {
  ColumnDefinition,
  RowDefinition,
  CellData,
} from '@/lib/types/table-schema';

// Re-export column types for convenience
export { ColumnType, formatCellValue } from '@/lib/types/column-types';
