/**
 * usePointerKeyboardNav Hook
 * Drives the Smart Pointer (activeCell) via Tab / Shift+Tab / Arrow keys.
 * Tab/Shift+Tab follow `navigationMode` (row-first vs column-first) via the
 * shared navigationStrategies; Arrow keys always move spatially.
 * Based on: docs/06_SMART_POINTER.md §3.3, §4
 */

import { useEffect, useMemo } from 'react';
import { useUIStore, resolveSelectionCells } from '@/lib/client/stores/ui-store';
import type { CellPosition, NavigationMode } from '@/lib/client/stores/ui-store';
import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import { navigationStrategies } from '@/lib/client/navigation/strategies';

interface UsePointerKeyboardNavOptions {
  tableSchema: TableSchema;
  /** false disables all keyboard handling, e.g. read-only tables or while the pointer is locked mid-recording */
  enabled: boolean;
  /** Required to clear cells (Delete/Backspace) — omit for read-only tables, which pass enabled: false anyway. */
  tableId?: string;
}

const NAV_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// Handled separately from NAV_KEYS so the arrow-key resolver never sees
// these — Delete/Backspace clear cells, they don't move the pointer.
// docs/features/20_interactive_grid_selection.md §6
const CLEAR_KEYS = new Set(['Delete', 'Backspace']);

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/**
 * Pure resolver: given a nav key + current pointer state, returns the next
 * cell (or null if the key is unhandled or the move is out of bounds).
 * Kept separate from the DOM listener so it can be unit tested directly.
 */
export function resolveKeyboardNavigation(
  key: string,
  shiftKey: boolean,
  activeCell: CellPosition,
  tableSchema: TableSchema,
  navigationMode: NavigationMode,
  rowIndexMap: Map<string, number>,
  colIndexMap: Map<string, number>
): CellPosition | null {
  const rowIndex = rowIndexMap.get(activeCell.rowKey);
  const colIndex = colIndexMap.get(activeCell.tableColumnId);
  if (rowIndex === undefined || colIndex === undefined) return null;

  switch (key) {
    case 'Tab': {
      const strategy = navigationStrategies[navigationMode];
      return shiftKey
        ? strategy.getPrevious(activeCell, tableSchema, rowIndexMap, colIndexMap)
        : strategy.getNext(activeCell, tableSchema, rowIndexMap, colIndexMap);
    }

    case 'ArrowUp':
      return rowIndex > 0
        ? { rowKey: tableSchema.rows[rowIndex - 1].id, tableColumnId: activeCell.tableColumnId }
        : null;

    case 'ArrowDown':
      return rowIndex < tableSchema.rows.length - 1
        ? { rowKey: tableSchema.rows[rowIndex + 1].id, tableColumnId: activeCell.tableColumnId }
        : null;

    case 'ArrowLeft':
      return colIndex > 0
        ? { rowKey: activeCell.rowKey, tableColumnId: tableSchema.columns[colIndex - 1].id }
        : null;

    case 'ArrowRight':
      return colIndex < tableSchema.columns.length - 1
        ? { rowKey: activeCell.rowKey, tableColumnId: tableSchema.columns[colIndex + 1].id }
        : null;

    default:
      return null;
  }
}

/**
 * Pure resolver: which of the given cells are writable (not locked/base
 * columns), turned into the ClearCellWrite shape updateCellsBatch expects.
 * Kept separate from the DOM listener so it can be unit tested directly,
 * mirroring resolveKeyboardNavigation above.
 * docs/features/20_interactive_grid_selection.md §6, §8
 */
export function resolveClearWrites(
  cells: CellPosition[],
  writableColumnIds: Set<string>
): Array<{ rowKey: string; tableColumnId: string; value: null }> {
  return cells
    .filter((cell) => writableColumnIds.has(cell.tableColumnId))
    .map((cell) => ({ rowKey: cell.rowKey, tableColumnId: cell.tableColumnId, value: null }));
}

export function usePointerKeyboardNav({ tableSchema, enabled, tableId }: UsePointerKeyboardNavOptions): void {
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const extendSelection = useUIStore((state) => state.extendSelection);

  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    tableSchema.rows.forEach((row, index) => map.set(row.id, index));
    return map;
  }, [tableSchema.rows]);

  const colIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    tableSchema.columns.forEach((col, index) => map.set(col.id, index));
    return map;
  }, [tableSchema.columns]);

  // Base-list (locked) columns must stay unwritable, mirroring the same
  // isBaseColumn guard DataTable's onClick already applies.
  // docs/features/20_interactive_grid_selection.md §3.3, §6
  const writableColumnIds = useMemo(
    () => new Set(tableSchema.columns.filter((col) => col.isBaseColumn !== true).map((col) => col.id)),
    [tableSchema.columns]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleClear = (event: KeyboardEvent) => {
      const { activeCell, selectionRange, gridOrder } = useUIStore.getState();

      // Prefer the resolved multi-cell rectangle; fall back to the lone
      // active cell when there is no (multi-cell) selection. Re-resolving
      // here rather than reading selectedKeys avoids parsing cellKey()
      // strings back into {rowKey, tableColumnId} pairs.
      const targets = selectionRange
        ? resolveSelectionCells(selectionRange, gridOrder)
        : [];
      const cells = targets.length > 0 ? targets : activeCell ? [activeCell] : [];
      if (cells.length === 0) return;

      event.preventDefault();

      const writes = resolveClearWrites(cells, writableColumnIds);

      // Every targeted cell was locked/read-only — nothing to clear, and
      // never call the batch endpoint with an empty write list. §6
      if (writes.length === 0 || !tableId) return;

      useTableCellStore.getState().updateCellsBatch(tableId, writes).catch(() => {
        // updateCellsBatch already rolled back optimistic state and set
        // `error` on the store — no separate error channel needed here,
        // matching the existing convention (table-cell-store.ts's own
        // updateCell/updateCellsBatch callers don't toast either).
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const { recordingState } = useUIStore.getState();
      if (recordingState !== 'idle') return;
      if (isTypingTarget(event.target)) return;

      if (CLEAR_KEYS.has(event.key)) {
        handleClear(event);
        return;
      }

      if (!NAV_KEYS.has(event.key)) return;

      const { activeCell, navigationMode, selectionRange } = useUIStore.getState();
      if (!activeCell) return;

      // Shift+Arrow extends the range from the current selection focus (so
      // repeated Shift+Arrow keeps growing the same selection) instead of
      // always stepping from activeCell; plain arrows are unaffected and
      // keep stepping from activeCell as before.
      // docs/features/20_interactive_grid_selection.md §5
      const isShiftArrow = event.shiftKey && event.key !== 'Tab';
      const basePosition = isShiftArrow ? selectionRange?.focus ?? activeCell : activeCell;

      event.preventDefault();

      const nextCell = resolveKeyboardNavigation(
        event.key,
        event.shiftKey,
        basePosition,
        tableSchema,
        navigationMode,
        rowIndexMap,
        colIndexMap
      );

      if (nextCell) {
        if (isShiftArrow) {
          extendSelection(nextCell);
        } else {
          setActiveCell(nextCell);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, tableSchema, tableId, rowIndexMap, colIndexMap, writableColumnIds, setActiveCell, extendSelection]);
}
