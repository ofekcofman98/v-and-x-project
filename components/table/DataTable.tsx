/**
 * DataTable Component
 * Spreadsheet-like grid with Smart Pointer integration
 * Based on: docs/08_UI_COMPONENTS.md §2.1
 * Performance: docs/10_PERFORMANCE.md §3.1, §3.2
 */

'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Key } from 'lucide-react';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTableCellStore } from '@/lib/stores/table-cell-store';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableCell } from './DataTableCell';
import { ColumnType } from '@/lib/types/column-types';
import { warmEntityCache } from '@/lib/matching/cache';
import type { ColumnDefinition, RowDefinition } from '@/lib/types/table-schema';

/**
 * DataTable Props
 */
interface DataTableProps {
  tableId: string;
  columns: ColumnDefinition[];
  rows: RowDefinition[];
  representativeColumnKey?: string | null;
  onCellClick?: (rowKey: string, tableColumnId: string) => void;
}

export const DataTable = memo(function DataTable({
  tableId,
  columns,
  rows,
  representativeColumnKey,
  onCellClick,
}: DataTableProps) {
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const isLoading = useTableCellStore((state) => state.isLoading);
  const error = useTableCellStore((state) => state.error);
  const fetchCells = useTableCellStore((state) => state.fetchCells);
  const { toast } = useToast();

  const [localRepKey, setLocalRepKey] = useState<string | null>(representativeColumnKey ?? null);

  // Keep local state in sync if the prop changes (e.g. parent refetch)
  useEffect(() => {
    setLocalRepKey(representativeColumnKey ?? null);
  }, [representativeColumnKey]);

  // Fetch data on mount
  useEffect(() => {
    fetchCells(tableId);
  }, [tableId, fetchCells]);

  // Switch the representative (Voice Key) column
  const handleRepresentativeColumnChange = useCallback(async (columnId: string) => {
    if (columnId === localRepKey) return;

    try {
      const response = await fetch(`/api/tables/${tableId}/representative-column`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ representative_column: columnId }),
      });

      if (!response.ok) throw new Error('Failed to update Voice Key');

      setLocalRepKey(columnId);

      toast({ title: 'Voice Key updated!' });

      // Re-warm entity cache so voice matching reflects the new key immediately
      warmEntityCache(rows);
    } catch {
      toast({
        title: 'Error',
        description: 'Could not update Voice Key. Please try again.',
        variant: 'destructive',
      });
    }
  }, [tableId, localRepKey, rows, toast]);

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
              {columns.map((column) => {
                const isRepresentative = column.id === localRepKey;
                // Key icon is only meaningful for Base List text columns —
                // custom table columns are not part of the voice matching entity vocabulary.
                const isBaseTextColumn =
                  column.isBaseColumn === true && column.type === ColumnType.TEXT;

                return (
                  <TableHead
                    key={column.id}
                    className={`text-xs font-medium uppercase tracking-wider transition-colors ${
                      isRepresentative
                        ? 'text-blue-700 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isBaseTextColumn && (
                        <button
                          onClick={() => handleRepresentativeColumnChange(column.id)}
                          title={isRepresentative ? 'Voice Key (Active)' : 'Set as Voice Key'}
                          className={`shrink-0 rounded p-0.5 transition-all ${
                            isRepresentative
                              ? 'text-blue-600 dark:text-blue-400 cursor-default'
                              : 'text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer'
                          }`}
                          disabled={isRepresentative}
                        >
                          <Key className={`h-3.5 w-3.5 ${isRepresentative ? 'fill-blue-600 dark:fill-blue-400' : ''}`} />
                        </button>
                      )}
                      <span>{column.label}</span>
                      {isRepresentative && (
                        <span className="ml-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded font-medium normal-case tracking-normal">
                          Voice Key
                        </span>
                      )}
                      <span className="ml-1 text-[11px] text-gray-400 dark:text-gray-500 lowercase font-normal">{column.type}</span>
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
        
        {/* Body Rows */}
        <TableBody className="bg-white dark:bg-gray-950">
          {rows.map((row, index) => (
            <TableRow key={row.id}>
              {/* Row header (sticky on scroll) */}
              <td className="px-4 py-3 text-center whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 sticky left-0 z-[5]">
                {index + 1}
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
