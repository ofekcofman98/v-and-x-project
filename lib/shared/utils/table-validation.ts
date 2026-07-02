import type { ColumnDef } from '@/components/shared-table/types';

export function validateGridSchema(
    title: string, 
    columns: ColumnDef[], 
    titleLabel: string = 'Name'
  ): string | null {
    if (!title.trim()) {
      return `${titleLabel} is required`;
    }
  
    if (columns.length === 0) {
      return 'At least one column is required';
    }
  
    const emptyColumns = columns.filter((col) => !col.name.trim());
    if (emptyColumns.length > 0) {
      return `${emptyColumns.length} column(s) missing a name`;
    }
  
    const names = columns.map((col) => col.name.toLowerCase().trim());
    if (new Set(names).size !== names.length) {
      return 'Column names must be unique';
    }
  
    return null;
  }