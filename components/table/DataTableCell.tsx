/**
 * TableCell Component
 * Individual cell with Smart Pointer highlighting
 * Based on: docs/08_UI_COMPONENTS.md §2.2
 * Performance: docs/10_PERFORMANCE.md §3.1, §3.2
 */

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTableCellStore } from '@/lib/stores/table-cell-store';
import { cn } from '@/lib/utils/cn';
import { ColumnType, formatCellValue } from '@/lib/types/column-types';

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

    // Update store subscriptions to use correct keys
    const isActive = useUIStore(
      (state) => state.activeCell?.rowKey === rowKey &&
                 state.activeCell?.tableColumnId === tableColumnId
    );

    // Similarly, only check lastUpdatedCell for this specific cell
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
    
    // Only subscribe to recordingState if this cell is active
    // This prevents inactive cells from re-rendering when recordingState changes
    const recordingState = useUIStore((state) => 
      isActive ? state.recordingState : 'idle'
    );
      
    const formattedValue = formatCellValue(value, columnType);
    
    return (
      <td
        onClick={onClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleCellKeyDown}
        tabIndex={isActive ? 0 : -1}
        className={cn(
          'px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100',
          'transition-all duration-200 relative',
          isReadOnly ? 'cursor-default' : 'cursor-pointer',
          !isReadOnly && 'hover:bg-gray-50 dark:hover:bg-gray-800',
          
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
        {/* Edit mode input or display value */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-none outline-none focus:ring-0 p-0 text-sm text-gray-900 dark:text-gray-100"
          />
        ) : (
          <span className="relative z-10">{formattedValue || '—'}</span>
        )}
        
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
