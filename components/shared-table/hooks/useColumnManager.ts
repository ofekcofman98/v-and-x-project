import { useState } from 'react';
import type { ColumnDef } from '../types';

export function useColumnManager(initialColumns: ColumnDef[] = []) {
  const [columns, setColumns] = useState<ColumnDef[]>(initialColumns);

  const addColumn = (column?: Partial<ColumnDef>) => {
    const newCol: ColumnDef = {
      id: column?.id || `col_${Date.now()}`,
      name: column?.name || '',
      type: column?.type || 'text',
      metadata: column?.metadata || { source: 'user_defined' },
    };
    setColumns([...columns, newCol]);
  };

  const updateColumn = (id: string, updates: Partial<ColumnDef>) => {
    setColumns(columns.map((col) =>
      col.id === id ? { ...col, ...updates } : col
    ));
  };

  const removeColumn = (id: string) => {
    const col = columns.find((c) => c.id === id);
    if (col?.metadata?.locked) return false;
    
    setColumns(columns.filter((c) => c.id !== id));
    return true;
  };

  const reorderColumns = (fromIndex: number, toIndex: number) => {
    const result = Array.from(columns);
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    setColumns(result);
  };

  return {
    columns,
    setColumns,
    addColumn,
    updateColumn,
    removeColumn,
    reorderColumns,
  };
}
