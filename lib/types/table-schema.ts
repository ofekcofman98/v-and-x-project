import { ColumnType } from '@/lib/types/column-types';

/**
 * Optional validation rules for a column
 */
export interface ColumnValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  required?: boolean;
}

/**
 * Column definition shared between UI and API layers
 */
export interface ColumnDefinition {
  id: string;
  label: string;
  type: ColumnType;
  validation?: ColumnValidation;
}

/**
 * Row definition for tables
 */
export interface RowDefinition {
  id: string;
  label: string;
  values?: Record<string, any>;  
}

/**
 * Cell value payload
 */

//Old 
// export interface CellData {
//   rowId: string;
//   columnId: string;
//   value: string | number | boolean | null;
// }

export interface CellData {
  rowKey: string;          // Changed from rowId
  tableColumnId: string;   // Changed from columnId
  value: string | number | boolean | null;
  entityId?: string | null;  // Optional: link to ListEntity
  entrySource?: string;      // Optional: how this data was entered
}

/**
 * Table schema used across the voice pipeline and table components
 */
export interface TableSchema {
  columns: ColumnDefinition[];
  rows: RowDefinition[];
}
