/**
 * DataTable Component
 * Spreadsheet-like grid with Smart Pointer integration
 * Based on: docs/08_UI_COMPONENTS.md §2.1
 * Performance: docs/10_PERFORMANCE.md §3.1, §3.2
 */

'use client';

import { memo, useCallback, useEffect } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTableCellStore } from '@/lib/stores/table-cell-store';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableCell } from './DataTableCell';
import type { ColumnDefinition, RowDefinition } from '@/lib/types/table-schema';

/**
 * DataTable Props
 */
interface DataTableProps {
  tableId: string;
  columns: ColumnDefinition[];
  rows: RowDefinition[];
  // data: CellData[];
  onCellClick?: (rowKey: string, tableColumnId: string) => void;
}

export const DataTable = memo(function DataTable({
  tableId,
  columns,
  rows,
  onCellClick,
}: DataTableProps) {
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const isLoading = useTableCellStore((state) => state.isLoading);
  const error = useTableCellStore((state) => state.error);
  const fetchCells = useTableCellStore((state) => state.fetchCells);

  // Fetch data on mount
  useEffect(() => {
    fetchCells(tableId);
  }, [tableId, fetchCells]);

  // Handlers
  const handleCellClick = useCallback((rowKey: string, tableColumnId: string) => {
    setActiveCell({ rowKey, tableColumnId });
    onCellClick?.(rowKey, tableColumnId);
  }, [setActiveCell, onCellClick]);
  
  return (
    <div className="w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-gray-500">Loading table data...</div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-red-500">Error loading table data: {error}</div>
        </div>
      )}
      {!isLoading && !error && (
        <Table>
          {/* Header Row */}
          <TableHeader className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
            <TableRow>
              {/* Empty corner cell */}
              <TableHead className="w-[150px] font-semibold text-gray-900 dark:text-gray-100">
                {/* Row labels column header */}
              </TableHead>
              
              {/* Column headers */}
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider"
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        
        {/* Body Rows */}
        <TableBody className="bg-white dark:bg-gray-950">
          {rows.map((row) => (
            <TableRow key={row.id}>
              {/* Row header (sticky on scroll) */}
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 sticky left-0 z-[5]">
                {row.label}
              </td>
              
              {/* Data cells */}
              {columns.map((column) => (
                <DataTableCell
                  key={`${row.id}-${column.id}`}
                  tableId={tableId}
                  rowKey={row.id}
                  tableColumnId={column.id}
                  columnType={column.type}
                  isBaseColumn={column.isBaseColumn}
                  baseValue={row.values?.[column.id]}
                  isReadOnly={column.isBaseColumn === true}
                  onClick={() => handleCellClick(row.id, column.id)}
                />
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      )}
    </div>
  );
});
