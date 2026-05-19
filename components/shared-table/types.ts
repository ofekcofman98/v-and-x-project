export interface ColumnDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date';
  metadata?: {
    source?: 'base_list' | 'user_defined';
    baseListColumnId?: string;
    locked?: boolean;
  };
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
