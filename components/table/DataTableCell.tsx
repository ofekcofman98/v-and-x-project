/**
 * TableCell Component
 * Individual cell with Smart Pointer highlighting
 * Based on: docs/08_UI_COMPONENTS.md §2.2
 */

'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils/cn';
import { ColumnType, formatCellValue } from '@/lib/types/column-types';

interface DataTableCellProps {
  rowId: string;
  columnId: string;
  columnType: ColumnType;
  value: string | number | boolean | null | undefined;
  onClick: () => void;
}

export function DataTableCell({
  rowId,
  columnId,
  columnType,
  value,
  onClick,
}: DataTableCellProps) {
  const activeCell = useUIStore((state) => state.activeCell);
  const recordingState = useUIStore((state) => state.recordingState);
  
  const isActive =
    activeCell?.rowId === rowId && activeCell?.columnId === columnId;
  
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
        ]
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
      
      {/* Success animation overlay (will be added later with framer-motion) */}
      {isActive && recordingState === 'committing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded pointer-events-none">
          <div className="text-green-600 dark:text-green-400 text-lg">✓</div>
        </div>
      )}
    </td>
  );
}
