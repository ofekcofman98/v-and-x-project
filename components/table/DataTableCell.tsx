/**
 * TableCell Component
 * Individual cell with Smart Pointer highlighting
 * Based on: docs/08_UI_COMPONENTS.md §2.2
 * Performance: docs/10_PERFORMANCE.md §3.1, §3.2
 */

'use client';

import { memo } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTableDataStore } from '@/lib/stores/table-data-store';
import { cn } from '@/lib/utils/cn';
import { ColumnType, formatCellValue } from '@/lib/types/column-types';

interface DataTableCellProps {
  rowId: string;
  columnId: string;
  columnType: ColumnType;
  value: string | number | boolean | null | undefined;
  onClick: () => void;
}

export const DataTableCell = memo(
  function DataTableCell({
    rowId,
    columnId,
    columnType,
    value,
    onClick,
  }: DataTableCellProps) {
    // CRITICAL OPTIMIZATION (§3.2): Selective subscription to prevent unnecessary re-renders
    // We check if THIS specific cell is active, so each cell only re-renders when its own state changes
    const isActive = useUIStore(
      (state) => state.activeCell?.rowId === rowId && state.activeCell?.columnId === columnId
    );
    
    // Only subscribe to recordingState if this cell is active
    // This prevents inactive cells from re-rendering when recordingState changes
    const recordingState = useUIStore((state) => 
      isActive ? state.recordingState : 'idle'
    );
    
    // Similarly, only check lastUpdatedCell for this specific cell
    const isJustUpdated = useTableDataStore((state) =>
      state.lastUpdatedCell?.rowId === rowId && state.lastUpdatedCell?.columnId === columnId
    );
  
    const formattedValue = formatCellValue(value, columnType);
    
    return (
      <td
        onClick={onClick}
        className={cn(
          'px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100',
          'cursor-pointer transition-all duration-200 relative',
          'hover:bg-gray-50 dark:hover:bg-gray-800',
          
          // Active cell styles - Smart Pointer highlight
          isActive && [
            'ring-2 ring-blue-500 ring-inset',
            'bg-blue-50 dark:bg-blue-950',
            'font-medium',
            
            // State-specific background colors
            recordingState === 'listening' && 'bg-blue-100 dark:bg-blue-900 animate-pulse',
            recordingState === 'processing' && 'bg-yellow-50 dark:bg-yellow-950',
            recordingState === 'confirming' && 'bg-orange-50 dark:bg-orange-950',
          ],
          
          // Success animation (green flash)
          isJustUpdated && 'animate-[flash_0.5s_ease-in-out]'
        )}
      >
        {/* Value */}
        <span className="relative z-10">{formattedValue || '—'}</span>
        
        {/* Active indicator (blue corner triangle) */}
        {isActive && (
          <div className="absolute top-0 right-0 w-3 h-3">
            <div className="w-full h-full bg-blue-500 rounded-bl-lg" />
          </div>
        )}
        
        {/* Success animation overlay */}
        {isActive && recordingState === 'committing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded pointer-events-none">
            <div className="text-green-600 dark:text-green-400 text-lg">✓</div>
          </div>
        )}
        
        {/* Just updated overlay (green flash) */}
        {isJustUpdated && (
          <div className="absolute inset-0 bg-green-500/30 rounded pointer-events-none animate-[fadeOut_1s_ease-out]" />
        )}
      </td>
    );
  },
  // Custom comparison function (§3.1)
  // Only re-render if value, rowId, or columnId changes
  (prevProps, nextProps) => {
    return (
      prevProps.value === nextProps.value &&
      prevProps.rowId === nextProps.rowId &&
      prevProps.columnId === nextProps.columnId &&
      prevProps.columnType === nextProps.columnType
    );
  }
);
