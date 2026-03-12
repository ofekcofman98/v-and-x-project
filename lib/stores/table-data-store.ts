/**
 * Table Data Store - Manages cell data for tables
 * Based on: docs/04_STATE_MANAGEMENT.md §2.1
 */

import { create } from 'zustand';
import type { CellData } from '@/lib/types/table-schema';

/**
 * Table Data Store State
 */
interface TableDataState {
  // Cell data for the current table
  cellData: CellData[];
  
  // Last updated cell (for triggering success animation)
  lastUpdatedCell: { rowId: string; columnId: string } | null;
  
  // Actions
  setCellData: (data: CellData[]) => void;
  updateCell: (rowId: string, columnId: string, value: string | number | boolean | null) => void;
  getCellValue: (rowId: string, columnId: string) => string | number | boolean | null | undefined;
  clearLastUpdated: () => void;
}

/**
 * Create the Table Data Store
 */
export const useTableDataStore = create<TableDataState>((set, get) => ({
  // Initial state
  cellData: [],
  lastUpdatedCell: null,
  
  // Set the entire cell data array
  setCellData: (data) => set({ cellData: data }),
  
  // Update a single cell
  updateCell: (rowId, columnId, value) => {
    set((state) => {
      const existingIndex = state.cellData.findIndex(
        (cell) => cell.rowId === rowId && cell.columnId === columnId
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
          { rowId, columnId, value },
        ];
      }
      
      return {
        cellData: newCellData,
        lastUpdatedCell: { rowId, columnId },
      };
    });
    
    // Clear the lastUpdatedCell after animation duration
    setTimeout(() => {
      get().clearLastUpdated();
    }, 1000);
  },
  
  // Get a cell value
  getCellValue: (rowId, columnId) => {
    const cell = get().cellData.find(
      (d) => d.rowId === rowId && d.columnId === columnId
    );
    return cell?.value;
  },
  
  // Clear the last updated cell marker
  clearLastUpdated: () => set({ lastUpdatedCell: null }),
}));
