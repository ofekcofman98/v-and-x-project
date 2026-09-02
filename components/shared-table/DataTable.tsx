/**
 * DataTable Component
 * Spreadsheet-like grid with Smart Pointer integration
 * Based on: docs/08_UI_COMPONENTS.md §2.1
 * Performance: docs/10_PERFORMANCE.md §3.1, §3.2
 */

'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useShallow } from 'zustand/react/shallow';
import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
import { useToast } from '@/components/ui/use-toast';
import { usePointerKeyboardNav } from '@/lib/client/hooks/shared/use-pointer-keyboard-nav';
import { getNavBandAxis } from '@/lib/client/navigation/nav-band';
import { DataTableCell } from './DataTableCell';
import { ComputedCell } from './ComputedCell';
import { ColumnHeaderCell } from './ColumnHeaderCell';
import { ColumnAccessModal } from '@/components/tables/ColumnAccessModal';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { ColumnDefinition, RowDefinition } from '@/lib/shared/types/table-schema';
import type { ColumnAccess } from '@/lib/shared/types/column-access';
import type { ColumnDef } from './types';

/**
 * Row-number cell — carries the row-first nav-mode band (§6). Extracted so
 * only this one cell subscribes to activeCell/navigationMode per row,
 * instead of DataTable re-rendering its full rows.map() on every pointer
 * move. Primitives extracted via useShallow, boolean derived below —
 * deriving a composite boolean inside the selector itself was the root
 * cause of a real bug (a mode toggle without an activeCell change could
 * leave the previous mode's band stuck by one toggle).
 * docs/features/15_realtime_voice_feedback.md §6.1
 */
const RowIndexCell = memo(function RowIndexCell({
  rowKey,
  index,
}: {
  rowKey: string;
  index: number;
}) {
  const { navigationMode, activeRowKey } = useUIStore(
    useShallow((state) => ({
      navigationMode: state.navigationMode,
      activeRowKey: state.activeCell?.rowKey ?? null,
    }))
  );
  const isActiveRowBand = getNavBandAxis(navigationMode) === 'row' && activeRowKey === rowKey;

  return (
    <td
      className="h-9 w-10 text-center text-sm text-gray-400 select-none font-mono transition-colors duration-200"
      style={{
        background: isActiveRowBand ? 'rgba(19,80,27,0.08)' : '#f5f5f5',
        borderRight: isActiveRowBand ? '2px solid #13501B' : '1px solid #e5e7eb',
      }}
    >
      {index + 1}
    </td>
  );
});

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
    access: col.access,
  };
}

interface DataTableProps {
  /** Required when isReadOnly is false (default). Not used in read-only mode. */
  tableId?: string;
  columns: ColumnDefinition[];
  rows: RowDefinition[];
  representativeColumnKey?: string | null;
  onCellClick?: (rowKey: string, tableColumnId: string) => void;
  /**
   * When true, disables all write operations:
   *  - Skips the cell-fetch effect (no /api/tables/:id/cells call)
   *  - Disables the representative-column PATCH
   *  - All cells render as read-only regardless of isBaseColumn
   */
  isReadOnly?: boolean;
}

export const DataTable = memo(function DataTable({
  tableId,
  columns,
  rows,
  representativeColumnKey,
  onCellClick,
  isReadOnly = false,
}: DataTableProps) {
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  // Included in the row/cell/header `key`s below so a toggle forces a full
  // remount of the grid instead of relying on each cell's own reactive
  // subscription to pick up the new mode — a remounted component reads
  // current store state at mount time, so no stale band is possible even if
  // some in-place update were ever missed. Toggling nav mode is rare and
  // user-initiated, unlike pointer movement, so this doesn't reintroduce the
  // full-grid-re-render cost docs/features/11_perf_and_navigation.md §2a
  // warns against. docs/features/15_realtime_voice_feedback.md §6.1
  const navigationMode = useUIStore((state) => state.navigationMode);
  const isLoading = useTableCellStore((state) => state.isLoading);
  const error = useTableCellStore((state) => state.error);
  const fetchCells = useTableCellStore((state) => state.fetchCells);
  const { toast } = useToast();

  const [localRepKey, setLocalRepKey] = useState<string | null>(representativeColumnKey ?? null);
  const [accessModalColumnId, setAccessModalColumnId] = useState<string | null>(null);
  const accessModalColumn = columns.find((col) => col.id === accessModalColumnId) ?? null;

  // Keep local state in sync if the prop changes (e.g. parent refetch)
  useEffect(() => {
    setLocalRepKey(representativeColumnKey ?? null);
  }, [representativeColumnKey]);

  usePointerKeyboardNav({ tableSchema: { columns, rows }, enabled: !isReadOnly });

  // Fetch cell data only for editable (Table) views — BaseList has no table_cells rows.
  useEffect(() => {
    if (isReadOnly || !tableId) return;
    fetchCells(tableId);
  }, [tableId, fetchCells, isReadOnly]);

  // Switch the representative (Voice Key) column — only available in editable (Table) views.
  const handleRepresentativeColumnChange = useCallback(async (columnId: string) => {
    if (isReadOnly || !tableId || columnId === localRepKey) return;

    try {
      const response = await fetch(`/api/tables/${tableId}/representative-column`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ representative_column: columnId }),
      });

      if (!response.ok) throw new Error('Failed to update Voice Key');

      setLocalRepKey(columnId);
      toast({ title: 'Voice Key updated!' });
    } catch {
      toast({
        title: 'Error',
        description: 'Could not update Voice Key. Please try again.',
        variant: 'destructive',
      });
    }
  }, [isReadOnly, tableId, localRepKey, rows, toast]);

  const handleCellClick = useCallback((rowKey: string, tableColumnId: string) => {
    setActiveCell({ rowKey, tableColumnId });
    onCellClick?.(rowKey, tableColumnId);
  }, [setActiveCell, onCellClick]);

  const handleAccessSubmit = useCallback(async (access: ColumnAccess) => {
    if (!tableId || !accessModalColumn) return;

    const response = await fetch(`/api/tables/${tableId}/columns/${accessModalColumn.id}/access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(access),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error?.[0] ?? 'Failed to update column access');
    }

    toast({ title: `"${accessModalColumn.label}" access updated` });
  }, [tableId, accessModalColumn, toast]);

  return (
    <div
      className="bg-white overflow-hidden"
      style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', boxShadow: '0 4px 40px rgba(0,0,0,0.06)' }}
    >
      {!isReadOnly && isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-gray-500">Loading table data...</div>
        </div>
      )}

      {!isReadOnly && error && (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-red-500">Error loading table data: {error}</div>
        </div>
      )}

      {(isReadOnly || (!isLoading && !error)) && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full">
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #e5e7eb' }}>
                {/* Row-number corner cell */}
                <th className="w-10" style={{ background: '#f5f5f5', borderRight: '1px solid #e5e7eb' }} />

                {/* Column headers — shared ColumnHeaderCell primitive */}
                {columns.map((column, index) => {
                  const isRepresentative = column.id === localRepKey;
                  // Key icon is only meaningful for Base List text columns —
                  // custom table columns are not part of the voice matching entity vocabulary.
                  const isBaseTextColumn =
                    column.isBaseColumn === true && column.type === ColumnType.TEXT;

                  return (
                    <ColumnHeaderCell
                      key={`${column.id}-${index}-${navigationMode}`}
                      column={toColumnDef(column)}
                      isRepresentative={isRepresentative}
                      onRepresentativeClick={
                        !isReadOnly && isBaseTextColumn
                          ? () => handleRepresentativeColumnChange(column.id)
                          : undefined
                      }
                      onAccessClick={
                        !isReadOnly && tableId && column.isBaseColumn !== true
                          ? () => setAccessModalColumnId(column.id)
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
                  className="hover:bg-gray-50 transition-colors"
                  style={{ background: index % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}
                >
                  {/* Row number — carries the row-first band */}
                  <RowIndexCell key={`${row.id}-${navigationMode}`} rowKey={row.id} index={index} />

                  {/* Data cells */}
                  {columns.map((column) =>
                    column.type === ColumnType.COMPUTED && column.formula ? (
                      <ComputedCell
                        key={`${row.id}-${column.id}-${index}-${navigationMode}`}
                        rowKey={row.id}
                        tableColumnId={column.id}
                        formula={column.formula}
                      />
                    ) : (
                      <DataTableCell
                        key={`${row.id}-${column.id}-${index}-${navigationMode}`}
                        tableId={tableId ?? ''}
                        rowKey={row.id}
                        tableColumnId={column.id}
                        columnType={column.type}
                        isBaseColumn={column.isBaseColumn}
                        baseValue={row.values?.[column.id]}
                        isReadOnly={isReadOnly || column.isBaseColumn === true}
                        onClick={() => {
                          if (!isReadOnly && column.isBaseColumn !== true) {
                            handleCellClick(row.id, column.id);
                          }
                        }}
                      />
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {accessModalColumn && tableId && (
        <ColumnAccessModal
          columnLabel={accessModalColumn.label}
          access={accessModalColumn.access}
          open={accessModalColumnId !== null}
          onOpenChange={(open) => !open && setAccessModalColumnId(null)}
          onSubmit={handleAccessSubmit}
        />
      )}
    </div>
  );
});
