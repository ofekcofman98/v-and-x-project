/**
 * Mobile-Optimized Table View
 * Card-based view for mobile devices
 * Based on: docs/08_UI_COMPONENTS.md §6.1
 */

'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils/cn';
import { formatCellValue } from '@/lib/types/column-types';
import type { ColumnDefinition, RowDefinition, CellData } from '@/lib/types/table-schema';

interface MobileTableViewProps {
  columns: ColumnDefinition[];
  rows: RowDefinition[];
  data: CellData[];
  onCellClick?: (rowId: string, columnId: string) => void;
}

export function MobileTableView({
  columns,
  rows,
  data,
  onCellClick,
}: MobileTableViewProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  
  const getCellValue = (rowId: string, columnId: string) => {
    const cell = data.find(
      (d) => d.rowId === rowId && d.columnId === columnId
    );
    return cell?.value;
  };
  
  const handleCellClick = (rowId: string, columnId: string) => {
    setActiveCell({ rowId, columnId });
    onCellClick?.(rowId, columnId);
  };
  
  return (
    <div className="lg:hidden space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          {/* Row Header */}
          <button
            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {row.label}
            </span>
            <ChevronRight
              className={cn(
                "h-5 w-5 text-gray-400 transition-transform",
                expandedRow === row.id && "rotate-90"
              )}
            />
          </button>
          
          {/* Expanded Content */}
          {expandedRow === row.id && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-800">
              {columns.map((col) => {
                const value = getCellValue(row.id, col.id);
                const formattedValue = formatCellValue(value, col.type);
                return (
                  <button
                    key={col.id}
                    onClick={() => handleCellClick(row.id, col.id)}
                    className="w-full flex justify-between items-center py-2 hover:bg-gray-50 dark:hover:bg-gray-900 rounded px-2 -mx-2"
                  >
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {col.label}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formattedValue || '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
