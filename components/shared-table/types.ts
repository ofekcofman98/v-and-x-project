import type { ColumnAccess } from '@/lib/shared/types/column-access';
import type { ColumnFormula } from '@/lib/shared/types/formula';

export interface ColumnDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'computed';
  metadata?: {
    source?: 'base_list' | 'user_defined' | 'template';
    baseListColumnId?: string;
    locked?: boolean;
  };
  access?: ColumnAccess | null;
  /** Validation rules (required/min/max/pattern/...) carried over from a Base List or Column Template source. */
  validation?: Record<string, unknown>;
  /** Present when type === 'computed'. */
  formula?: ColumnFormula;
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
