import { useState } from 'react';
import type { RowData, ColumnDef } from '../types';

export function useRowManager(
  initialRows: RowData[] = [],
  columns: ColumnDef[] = []
) {
  const [rows, setRows] = useState<RowData[]>(initialRows);

  const addRow = (row?: Partial<RowData>) => {
    const newRow: RowData = {
      id: row?.id || `row_${Date.now()}`,
      values: row?.values || {},
      metadata: row?.metadata || { source: 'inline' },
    };
    setRows([...rows, newRow]);
  };

  const updateCell = (rowId: string, colId: string, value: string) => {
    setRows(rows.map((row) =>
      row.id === rowId
        ? { ...row, values: { ...row.values, [colId]: value } }
        : row
    ));
  };

  const removeRow = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (row?.metadata?.locked) return false;
    
    setRows(rows.filter((r) => r.id !== rowId));
    return true;
  };

  const clearColumn = (colId: string) => {
    setRows(rows.map((row) => {
      const { [colId]: _, ...rest } = row.values;
      return { ...row, values: rest };
    }));
  };

  return {
    rows,
    setRows,
    addRow,
    updateCell,
    removeRow,
    clearColumn,
  };
}
