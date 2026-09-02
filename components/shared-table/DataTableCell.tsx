/**
 * DataTableCell Component
 * Individual cell with Smart Pointer highlighting
 * Based on: docs/08_UI_COMPONENTS.md §2.2
 * Performance: docs/10_PERFORMANCE.md §3.1, §3.2
 */

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useShallow } from 'zustand/react/shallow';
import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
import { cn } from '@/lib/shared/utils/cn';
import { ColumnType, formatCellValue } from '@/lib/shared/types/column-types';
import { coerceCellValue } from '@/lib/shared/parsers/cell-value';

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
    const [hasError, setHasError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Subscribe to store value for table columns (reactive!)
    const storeCellValue = useTableCellStore((state) =>
      state.getCellValue(rowKey, tableColumnId)
    );

    // Determine the actual value to display
    const value = isBaseColumn ? baseValue : storeCellValue;

    // Local state for editing
    const [editedValue, setEditedValue] = useState(value?.toString() || '');

    // Extract ONLY primitive values from the store, shallow-compared —
    // then derive every boolean (isActive, isInActiveBand,
    // isProvisionalTarget) from those primitives in the render body below,
    // not inside the selector. Computing derived/composite values inside a
    // selector risks the equality check on the derived output missing an
    // update in some edge case; deriving from freshly-extracted primitives
    // in the same render pass cannot. This was the root cause of a real bug:
    // switching navigationMode without changing activeCell left most of the
    // previous mode's band stuck until the NEXT toggle. docs/features/15_realtime_voice_feedback.md §6, §3-§4
    const { activeRowKey, activeColumnId, navigationMode, provisionalRowKey, provisionalValue } = useUIStore(
      useShallow((state) => ({
        activeRowKey: state.activeCell?.rowKey ?? null,
        activeColumnId: state.activeCell?.tableColumnId ?? null,
        navigationMode: state.navigationMode,
        provisionalRowKey: state.provisionalFeedback.provisionalRowKey,
        provisionalValue: state.provisionalFeedback.provisionalValue,
      }))
    );

    const isActive = activeRowKey === rowKey && activeColumnId === tableColumnId;

    const isInActiveBand =
      !isActive &&
      activeRowKey !== null &&
      (navigationMode === 'column-first'
        ? activeColumnId === tableColumnId
        : activeRowKey === rowKey);

    const isProvisionalTarget =
      !isActive && provisionalRowKey === rowKey && activeColumnId === tableColumnId;

    // Pure selector: derives from store state + stable props only, so this
    // snapshot is always causally consistent with the activeCell snapshot
    // above. Closing over the render-scope `isActive` here used to couple
    // two independent subscriptions and could strand the `listening` tint
    // on a cell the pointer had already left (same class of bug as the
    // note at L53-61). Still only re-renders when this cell is active
    // (§3.1) — the perf property is preserved, just derived purely.
    const recordingState = useUIStore((state) =>
      state.activeCell?.rowKey === rowKey && state.activeCell?.tableColumnId === tableColumnId
        ? state.recordingState
        : 'idle'
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
      setHasError(false);
      setEditedValue(value?.toString() || '');
    };

    // Handle key down on the cell (local event, no global listener)
    const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>) => {
      if (isReadOnly || isEditing) return;
      if (e.key === 'Enter') {
        setIsEditing(true);
        setHasError(false);
        setEditedValue(value?.toString() || '');
      }
    };

    // Save on blur or Enter. Runs the edited text through the same
    // coercion the voice pipeline uses (coerceCellValue → parseBoolean for
    // BOOLEAN columns) so typing "no" and saying "no" store the identical
    // value. Unparseable input is rejected — the cell stays in edit mode
    // with an error style instead of silently discarding what was typed.
    const handleSave = async () => {
      if (isReadOnly) {
        setIsEditing(false);
        return;
      }
      if (editedValue === value?.toString()) {
        setIsEditing(false);
        return;
      }

      const result = coerceCellValue(editedValue, columnType);
      if (!result.ok) {
        setHasError(true);
        inputRef.current?.focus();
        return;
      }

      setHasError(false);
      setIsEditing(false);
      await useTableCellStore.getState().updateCell(
        tableId,
        rowKey,
        tableColumnId,
        result.value
      );
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setHasError(false);
        setEditedValue(value?.toString() || '');
      }
    };

    const formattedValue = formatCellValue(value, columnType);

    // The ghost renders on the guessed cell in column-first, and on the
    // active cell in row-first (where the pointer already fixes the row).
    // It never covers a committed value — only an empty cell — so a wrong
    // guess never looks like an overwrite. Deliberately does not reuse
    // isProvisionalTarget: that one carries `!isActive` (correct for the
    // dashed border, wrong here since row-first ghosts the active cell).
    const isProvisionalGhost =
      !isReadOnly &&
      !isEditing &&
      provisionalValue !== null &&
      provisionalRowKey === rowKey &&
      activeColumnId === tableColumnId &&
      !formattedValue;
    const formattedProvisionalValue = isProvisionalGhost
      ? formatCellValue(provisionalValue, columnType)
      : null;

    return (
      <td
        onClick={onClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleCellKeyDown}
        tabIndex={isActive && !isReadOnly ? 0 : -1}
        className={cn(
          // Shared DataCell baseline: left border separator, zero outer padding
          'border-l first:border-l-0 p-0',
          'transition-all duration-200',
          // Read-only base tinting
          isReadOnly && 'bg-gray-50/60',
          recordingState === 'processing' && isActive && !isReadOnly && 'bg-yellow-50',
          recordingState === 'confirming' && isActive && !isReadOnly && 'bg-orange-50',
        )}
        style={{
          borderColor: '#e5e7eb',
          background:
            isActive && !isReadOnly && recordingState !== 'processing' && recordingState !== 'confirming'
              ? recordingState === 'listening'
                ? '#e8f2e9'
                : '#f2f8f2'
              // Deliberately weaker than the active-cell tints above, and
              // weaker than the provisional dashed outline's implied
              // urgency — this is structural context, not a pointer.
              : isInActiveBand && !isReadOnly
              ? 'rgba(19,80,27,0.05)'
              : undefined,
        }}
      >
        {/* Inner wrapper: fixes the h-9 row height (matches DataCell) and hosts
            the active ring + absolute overlays so they clip to the cell boundary.
            Also the sole host for opacity/background-color animations
            (listening pulse, success flash) — a <td> in a border-collapse
            table is a bad compositing-layer host: removing an animated class
            from it can leave the layer's last paint stuck on screen until an
            unrelated repaint (DevTools open, hover) flushes it. */}
        <div
          className={cn(
            'relative h-9 w-full',
            recordingState === 'listening' && isActive && !isReadOnly && 'animate-pulse',
            isJustUpdated && !isReadOnly && 'animate-[flash_0.5s_ease-in-out]',
          )}
          style={
            isActive && !isReadOnly
              ? { boxShadow: 'inset 0 0 0 2px #13501B' }
              : undefined
          }
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editedValue}
              onChange={(e) => {
                setEditedValue(e.target.value);
                setHasError(false);
              }}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full h-full px-2 py-1 text-sm bg-transparent border-none outline-none focus:ring-0 text-gray-900',
                columnType === ColumnType.NUMBER && 'font-mono',
                hasError && 'ring-1 ring-inset ring-red-500',
              )}
            />
          ) : (
            <div
              className={cn(
                'flex items-center w-full h-full px-2 py-1 text-sm overflow-hidden',
                isReadOnly
                  ? 'cursor-default select-none text-gray-400'
                  : 'cursor-pointer text-gray-900 hover:bg-gray-50',
                isActive && !isReadOnly && 'font-medium',
                columnType === ColumnType.NUMBER && 'font-mono',
              )}
            >
              <span className={cn('truncate', isProvisionalGhost && 'text-gray-400 italic')}>
                {isProvisionalGhost ? formattedProvisionalValue : formattedValue || '—'}
              </span>
            </div>
          )}

          {/* Provisional target — dashed grey outline, deliberately weaker
              than the active cell's solid ring, marking an unconfirmed guess. */}
          {isProvisionalTarget && !isReadOnly && (
            <div
              className="absolute inset-0 rounded pointer-events-none"
              style={{ border: '2px dashed #9ca3af' }}
            />
          )}

          {/* Active indicator (blue corner triangle) */}
          {isActive && (
            <div className="absolute top-0 right-0 w-3 h-3 pointer-events-none">
              <div className="w-full h-full rounded-bl-lg" style={{ background: '#13501B' }} />
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
            <div className="absolute inset-0 bg-green-500/30 rounded pointer-events-none animate-[fadeOut_1s_ease-out_forwards]" />
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
