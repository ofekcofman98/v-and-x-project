/**
 * DataTable Component
 * Spreadsheet-like grid with Smart Pointer integration
 * Based on: docs/08_UI_COMPONENTS.md §2.1
 */

'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { useTableDataStore } from '@/lib/stores/table-data-store';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableCell } from './DataTableCell';
import type { ColumnDefinition, RowDefinition, CellData } from '@/lib/types/table-schema';

/**
 * DataTable Props
 */
interface DataTableProps {
  columns: ColumnDefinition[];
  rows: RowDefinition[];
  data: CellData[];
  onCellClick?: (rowId: string, columnId: string) => void;
}

export function DataTable({
  columns,
  rows,
  data,
  onCellClick,
}: DataTableProps) {
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const cellData = useTableDataStore((state) => state.cellData);
  
  /**
   * Get cell value from data array (use store data if available, otherwise fallback to props)
   */
  const getCellValue = (rowId: string, columnId: string) => {
    // Try store first
    const storeCell = cellData.find(
      (d) => d.rowId === rowId && d.columnId === columnId
    );
    if (storeCell !== undefined) {
      return storeCell.value;
    }
    
    // Fallback to prop data
    const cell = data.find(
      (d) => d.rowId === rowId && d.columnId === columnId
    );
    return cell?.value;
  };
  
  /**
   * Handle cell click - update Smart Pointer
   */
  const handleCellClick = (rowId: string, columnId: string) => {
    setActiveCell({ rowId, columnId });
    onCellClick?.(rowId, columnId);
  };
  
  return (
    <div className="w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
      <Table>
        {/* Header Row */}
        <TableHeader className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
          <TableRow>
            {/* Empty corner cell */}
            <TableHead className="w-[150px] font-semibold text-gray-900 dark:text-gray-100">
              {/* Row labels column header */}
            </TableHead>
            
            {/* Column headers */}
            {columns.map((column) => (
              <TableHead
                key={column.id}
                className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider"
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        
        {/* Body Rows */}
        <TableBody className="bg-white dark:bg-gray-950">
          {rows.map((row) => (
            <TableRow key={row.id}>
              {/* Row header (sticky on scroll) */}
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 sticky left-0 z-[5]">
                {row.label}
              </td>
              
              {/* Data cells */}
              {columns.map((column) => (
                <DataTableCell
                  key={`${row.id}-${column.id}`}
                  rowId={row.id}
                  columnId={column.id}
                  columnType={column.type}
                  value={getCellValue(row.id, column.id)}
                  onClick={() => handleCellClick(row.id, column.id)}
                />
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
