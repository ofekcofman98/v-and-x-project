/**
 * usePointerKeyboardNav Hook
 * Drives the Smart Pointer (activeCell) via Tab / Shift+Tab / Arrow keys.
 * Tab/Shift+Tab follow `navigationMode` (row-first vs column-first) via the
 * shared navigationStrategies; Arrow keys always move spatially.
 * Based on: docs/06_SMART_POINTER.md §3.3, §4
 */

import { useEffect, useMemo } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import type { CellPosition, NavigationMode } from '@/lib/client/stores/ui-store';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import { navigationStrategies } from '@/lib/client/navigation/strategies';

interface UsePointerKeyboardNavOptions {
  tableSchema: TableSchema;
  /** false disables all keyboard handling, e.g. read-only tables or while the pointer is locked mid-recording */
  enabled: boolean;
}

const NAV_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

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

export function usePointerKeyboardNav({ tableSchema, enabled }: UsePointerKeyboardNavOptions): void {
  const setActiveCell = useUIStore((state) => state.setActiveCell);

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

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!NAV_KEYS.has(event.key)) return;

      const { activeCell, recordingState, navigationMode } = useUIStore.getState();

      if (!activeCell) return;
      if (recordingState !== 'idle') return;
      if (isTypingTarget(event.target)) return;

      event.preventDefault();

      const nextCell = resolveKeyboardNavigation(
        event.key,
        event.shiftKey,
        activeCell,
        tableSchema,
        navigationMode,
        rowIndexMap,
        colIndexMap
      );

      if (nextCell) {
        setActiveCell(nextCell);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, tableSchema, rowIndexMap, colIndexMap, setActiveCell]);
}
