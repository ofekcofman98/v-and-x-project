import type { ColumnAccess } from '@/lib/shared/types/column-access';

export interface ColumnDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date';
  metadata?: {
    source?: 'base_list' | 'user_defined' | 'template';
    baseListColumnId?: string;
    locked?: boolean;
  };
  access?: ColumnAccess | null;
  /** Validation rules (required/min/max/pattern/...) carried over from a Base List or Column Template source. */
  validation?: Record<string, unknown>;
}

export interface RowData {
  id: string;
  values: Record<string, string>;
  metadata?: {
    source?: 'base_list' | 'inline';
    entityId?: string;
    locked?: boolean;
  };
}

export interface TableMetadata {
  baseListId?: string;
  baseListName?: string;
}
