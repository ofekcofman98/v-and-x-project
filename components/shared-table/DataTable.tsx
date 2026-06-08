/**
 * DataTable Component
 * Spreadsheet-like grid with Smart Pointer integration
 * Based on: docs/08_UI_COMPONENTS.md §2.1
 * Performance: docs/10_PERFORMANCE.md §3.1, §3.2
 */

'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTableCellStore } from '@/lib/stores/table-cell-store';
import { useToast } from '@/components/ui/use-toast';
import { DataTableCell } from './DataTableCell';
import { ColumnHeaderCell } from './ColumnHeaderCell';
import { ColumnType } from '@/lib/types/column-types';
import { warmEntityCache } from '@/lib/matching/cache';
import type { ColumnDefinition, RowDefinition } from '@/lib/types/table-schema';
import type { ColumnDef } from './types';

/**
 * Adapts a ColumnDefinition (table-schema) to the ColumnDef shape ColumnHeaderCell expects.
 * - ColumnType enum values are uppercase; ColumnDef['type'] uses lowercase literals.
 * - All columns are locked in the data view — structure editing belongs to the builder.
 */
function toColumnDef(col: ColumnDefinition): ColumnDef {
  return {
    id: col.id,
    name: col.label,
    type: col.type.toLowerCase() as ColumnDef['type'],
    metadata: {
      source: col.isBaseColumn ? 'base_list' : 'user_defined',
      locked: true,
    },
  };
}

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

  const handleCellClick = useCallback((rowKey: string, tableColumnId: string) => {
    setActiveCell({ rowKey, tableColumnId });
    onCellClick?.(rowKey, tableColumnId);
  }, [setActiveCell, onCellClick]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-slate-500">Loading table data...</div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-red-500">Error loading table data: {error}</div>
        </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full">
            <thead>
              <tr className="border-b border-slate-200">
                {/* Row-number corner cell */}
                <th className="w-10 bg-slate-50 border-r border-slate-200" />

                {/* Column headers — shared ColumnHeaderCell primitive */}
                {columns.map((column, index) => {
                  const isRepresentative = column.id === localRepKey;
                  // Key icon is only meaningful for Base List text columns —
                  // custom table columns are not part of the voice matching entity vocabulary.
                  const isBaseTextColumn =
                    column.isBaseColumn === true && column.type === ColumnType.TEXT;

                  return (
                    <ColumnHeaderCell
                      key={`${column.id}-${index}`}
                      column={toColumnDef(column)}
                      isRepresentative={isRepresentative}
                      onRepresentativeClick={
                        isBaseTextColumn
                          ? () => handleRepresentativeColumnChange(column.id)
                          : undefined
                      }
                      // No-ops: column structure editing belongs to the builder, not the data view
                      onNameChange={() => {}}
                      onTypeChange={() => {}}
                      onDelete={() => {}}
                    />
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors"
                >
                  {/* Row number */}
                  <td className="h-9 w-10 text-center text-sm text-slate-400 bg-slate-50 border-r border-slate-200 select-none">
                    {index + 1}
                  </td>

                  {/* Data cells */}
                  {columns.map((column) => (
                    <DataTableCell
                      key={`${row.id}-${column.id}-${index}`}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
