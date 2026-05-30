/**
 * Mobile-Optimized Table View
 * Card-based view for mobile devices
 * Based on: docs/08_UI_COMPONENTS.md §6.1
 * Performance: docs/10_PERFORMANCE.md §3.1, §3.2
 */

'use client';

import { memo, useCallback, useState } from 'react';
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

export const MobileTableView = memo(function MobileTableView({
  columns,
  rows,
  data,
  onCellClick,
}: MobileTableViewProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const setActiveCell = useUIStore((state) => state.setActiveCell);

  const getCellValue = useCallback((rowId: string, columnId: string) => {
    const cell = data.find(
      (d) => d.rowKey === rowId && d.tableColumnId === columnId
    );
    return cell?.value;
  }, [data]);

  const handleCellClick = useCallback((rowId: string, columnId: string) => {
    setActiveCell({ rowKey: rowId, tableColumnId: columnId });
    onCellClick?.(rowId, columnId);
  }, [setActiveCell, onCellClick]);

  return (
    <div className="lg:hidden space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* Row Header */}
          <button
            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <span className="font-medium text-slate-900">
              {row.label}
            </span>
            <ChevronRight
              className={cn(
                'h-5 w-5 text-slate-400 transition-transform',
                expandedRow === row.id && 'rotate-90'
              )}
            />
          </button>

          {/* Expanded Content */}
          {expandedRow === row.id && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
              {columns.map((col) => {
                const value = getCellValue(row.id, col.id);
                const formattedValue = formatCellValue(value, col.type);
                return (
                  <button
                    key={col.id}
                    onClick={() => handleCellClick(row.id, col.id)}
                    className="w-full flex justify-between items-center py-2 hover:bg-slate-50 rounded px-2 -mx-2"
                  >
                    <span className="text-sm text-slate-500">
                      {col.label}
                    </span>
                    <span className="font-medium text-slate-900">
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
});
