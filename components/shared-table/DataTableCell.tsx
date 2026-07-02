/**
 * DataTableCell Component
 * Individual cell with Smart Pointer highlighting
 * Based on: docs/08_UI_COMPONENTS.md §2.2
 * Performance: docs/10_PERFORMANCE.md §3.1, §3.2
 */

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
import { cn } from '@/lib/shared/utils/cn';
import { ColumnType, formatCellValue } from '@/lib/shared/types/column-types';

interface DataTableCellProps {
  tableId: string;
  rowKey: string;
  tableColumnId: string;
  columnType: ColumnType;
  isBaseColumn?: boolean;
  baseValue?: string | number | boolean | null | undefined;
  isReadOnly?: boolean;
  onClick: () => void;
}

export const DataTableCell = memo(
  function DataTableCell({
    tableId,
    rowKey,
    tableColumnId,
    columnType,
    isBaseColumn,
    baseValue,
    isReadOnly,
    onClick,
  }: DataTableCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Subscribe to store value for table columns (reactive!)
    const storeCellValue = useTableCellStore((state) =>
      state.getCellValue(rowKey, tableColumnId)
    );

    // Determine the actual value to display
    const value = isBaseColumn ? baseValue : storeCellValue;

    // Local state for editing
    const [editedValue, setEditedValue] = useState(value?.toString() || '');

    const isActive = useUIStore(
      (state) =>
        state.activeCell?.rowKey === rowKey &&
        state.activeCell?.tableColumnId === tableColumnId
    );

    // Only check lastUpdatedCell for this specific cell
    const isJustUpdated = useTableCellStore((state) =>
      state.lastUpdatedCell?.rowKey === rowKey &&
      state.lastUpdatedCell?.tableColumnId === tableColumnId
    );

    // Focus input when entering edit mode
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    const handleDoubleClick = () => {
      if (isReadOnly) return;
      setIsEditing(true);
      setEditedValue(value?.toString() || '');
    };

    // Handle key down on the cell (local event, no global listener)
    const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>) => {
      if (isReadOnly || isEditing) return;
      if (e.key === 'Enter') {
        setIsEditing(true);
        setEditedValue(value?.toString() || '');
      }
    };

    // Save on blur or Enter
    const handleSave = async () => {
      setIsEditing(false);
      if (editedValue !== value?.toString()) {
        await useTableCellStore.getState().updateCell(
          tableId,
          rowKey,
          tableColumnId,
          editedValue
        );
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditedValue(value?.toString() || '');
      }
    };

    // Only subscribe to recordingState if this cell is active —
    // prevents inactive cells from re-rendering when recordingState changes (§3.1)
    const recordingState = useUIStore((state) =>
      isActive ? state.recordingState : 'idle'
    );

    const formattedValue = formatCellValue(value, columnType);

    return (
      <td
        onClick={onClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleCellKeyDown}
        tabIndex={isActive && !isReadOnly ? 0 : -1}
        className={cn(
          // Shared DataCell baseline: left border separator, zero outer padding
          'border-l first:border-l-0 border-slate-200 p-0',
          'transition-all duration-200',
          // Read-only base tinting
          isReadOnly && 'bg-slate-50/60',
          // Voice state: active cell background floods the td
          isActive && !isReadOnly && [
            'bg-blue-50',
            recordingState === 'listening' && 'bg-blue-100 animate-pulse',
            recordingState === 'processing' && 'bg-yellow-50',
            recordingState === 'confirming' && 'bg-orange-50',
          ],
          // Success animation (green flash)
          isJustUpdated && !isReadOnly && 'animate-[flash_0.5s_ease-in-out]',
        )}
      >
        {/* Inner wrapper: fixes the h-9 row height (matches DataCell) and hosts
            the active ring + absolute overlays so they clip to the cell boundary */}
        <div
          className={cn(
            'relative h-9 w-full',
            isActive && !isReadOnly && 'ring-2 ring-blue-500 ring-inset',
          )}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editedValue}
              onChange={(e) => setEditedValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-full h-full px-2 py-1 text-sm bg-transparent border-none outline-none focus:ring-0 text-slate-900"
            />
          ) : (
            <div
              className={cn(
                'flex items-center w-full h-full px-2 py-1 text-sm overflow-hidden',
                isReadOnly
                  ? 'cursor-default select-none text-slate-400'
                  : 'cursor-pointer text-slate-900 hover:bg-slate-50',
                isActive && !isReadOnly && 'font-medium',
              )}
            >
              <span className="truncate">{formattedValue || '—'}</span>
            </div>
          )}

          {/* Active indicator (blue corner triangle) */}
          {isActive && (
            <div className="absolute top-0 right-0 w-3 h-3 pointer-events-none">
              <div className="w-full h-full bg-blue-500 rounded-bl-lg" />
            </div>
          )}

          {/* Success animation overlay */}
          {isActive && recordingState === 'committing' && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded pointer-events-none">
              <div className="text-green-600 text-lg">✓</div>
            </div>
          )}

          {/* Just updated overlay (green flash) */}
          {isJustUpdated && (
            <div className="absolute inset-0 bg-green-500/30 rounded pointer-events-none animate-[fadeOut_1s_ease-out]" />
          )}
        </div>
      </td>
    );
  },
  // Custom comparison function (§3.1)
  // Only re-render if key props change (store subscription handles value updates)
  (prevProps, nextProps) => {
    return (
      prevProps.rowKey === nextProps.rowKey &&
      prevProps.tableColumnId === nextProps.tableColumnId &&
      prevProps.columnType === nextProps.columnType &&
      prevProps.isBaseColumn === nextProps.isBaseColumn &&
      prevProps.baseValue === nextProps.baseValue &&
      prevProps.isReadOnly === nextProps.isReadOnly
    );
  }
);
