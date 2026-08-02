import type { ColumnDef } from '@/components/shared-table/types';
import { ColumnType } from '@/lib/shared/types/column-types';
import { validateFormula } from '@/lib/shared/utils/formula';

const GRID_TYPE_TO_COLUMN_TYPE: Record<ColumnDef['type'], ColumnType> = {
  text: ColumnType.TEXT,
  number: ColumnType.NUMBER,
  boolean: ColumnType.BOOLEAN,
  date: ColumnType.DATE,
  computed: ColumnType.COMPUTED,
};

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

    const keyedColumns = columns.map((col) => ({ id: col.id, type: GRID_TYPE_TO_COLUMN_TYPE[col.type] }));
    for (const col of columns) {
      if (col.type === 'computed') {
        if (!col.formula) {
          return `"${col.name}" needs a formula`;
        }
        const errors = validateFormula(col.id, col.formula, keyedColumns);
        if (errors.length > 0) {
          return `"${col.name}": ${errors[0].message}`;
        }
      }
    }

    return null;
  }