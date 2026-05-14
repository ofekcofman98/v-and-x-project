/**
 * Table Cell Store - Manages cell data for tables
 * Based on: docs/04_STATE_MANAGEMENT.md §2.1
 */

import { create } from 'zustand';
import type { CellData } from '@/lib/types/table-schema';

/**
 * Table Cell Store State
 */
interface TableCellState {
  // Cell data for the current table
  cellData: CellData[];
  
  // Last updated cell (for triggering success animation)
  lastUpdatedCell: { rowKey: string; tableColumnId: string } | null;
  
  // Actions
  setCellData: (data: CellData[]) => void;
  updateCell: (rowKey: string, tableColumnId: string, value: string | number | boolean | null) => void;
  getCellValue: (rowKey: string, tableColumnId: string) => string | number | boolean | null | undefined;
  clearLastUpdated: () => void;
}

/**
 * Create the Table Cell Store
 */
export const useTableCellStore = create<TableCellState>((set, get) => ({
  // Initial state
  cellData: [],
  lastUpdatedCell: null,
  
  // Set the entire cell data array
  setCellData: (data) => set({ cellData: data }),
  
  // Update a single cell
  updateCell: (rowKey, tableColumnId, value) => {
    set((state) => {
      const existingIndex = state.cellData.findIndex(
        (cell) => cell.rowKey === rowKey && cell.tableColumnId === tableColumnId
      );
      
      let newCellData: CellData[];
      
      if (existingIndex >= 0) {
        // Update existing cell
        newCellData = [...state.cellData];
        newCellData[existingIndex] = {
          ...newCellData[existingIndex],
          value,
        };
      } else {
        // Add new cell
        newCellData = [
          ...state.cellData,
          { rowKey, tableColumnId, value },
        ];
      }
      
      return {
        cellData: newCellData,
        lastUpdatedCell: { rowKey, tableColumnId },
      };
    });
    
    // Clear the lastUpdatedCell after animation duration
    setTimeout(() => {
      get().clearLastUpdated();
    }, 1000);
  },
  
  // Get a cell value
  getCellValue: (rowKey, tableColumnId) => {
    const cell = get().cellData.find(
      (d) => d.rowKey === rowKey && d.tableColumnId === tableColumnId
    );
    return cell?.value;
  },
  
  // Clear the last updated cell marker
  clearLastUpdated: () => set({ lastUpdatedCell: null }),
}));
