/**
 * Table Cell Store - Manages cell data for tables
 * Based on: docs/04_STATE_MANAGEMENT.md §2.1
 */

import { create } from 'zustand';
import type { CellData } from '@/lib/shared/types/table-schema';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Table Cell Store State
 */
interface TableCellState {
  // Cell data for the current table
  cellData: CellData[];
  lastUpdatedCell: { rowKey: string; tableColumnId: string } | null;  // Last updated cell (for triggering success animation)
  isLoading: boolean;      // track loading state
  error: string | null;    // track errors

  // Actions
  setCellData: (data: CellData[]) => void;
  fetchCells: (tableId: string) => Promise<void>;
  updateCell: (tableId: string, rowKey: string, tableColumnId: string, value: string | number | boolean | null) => Promise<void>;
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
  isLoading: false,
  error: null,
  
  // Set the entire cell data array
  setCellData: (data) => set({ cellData: data }),
  
  fetchCells: async (tableId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/tables/${tableId}/cells`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cells: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // The API returns { data: cells } due to apiSuccess wrapper
      const cells = result.data;
      
      // Transform the API response to match CellData interface
      const cellData: CellData[] = cells.map((cell: any) => ({
        rowKey: cell.rowKey,
        tableColumnId: cell.tableColumnId,
        value: cell.value?.value ?? null,  // The DB stores value in JSON format
        entityId: cell.entityId,
        entrySource: cell.entrySource,
      }));
      
      set({ cellData, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, isLoading: false });
      console.error('Error fetching cells:', error);
    }
  },

  // Update a single cell
  updateCell: async (
    tableId: string,
    rowKey: string,
    tableColumnId: string,
    value: string | number | boolean | null
  ) => {
    // Guard: both identifiers must be database UUIDs. Base-list column IDs
    // are human-readable slugs (e.g. "first_name") and must never reach the API.
    if (!UUID_REGEX.test(rowKey) || !UUID_REGEX.test(tableColumnId)) {
      set({
        error:
          'Cannot save: the selected cell uses a read-only base-list column. ' +
          'Please select a data-entry column before saving.',
      });
      return;
    }

    // 1. SAVE THE PREVIOUS STATE (for rollback)
    const previousCellData = [...get().cellData];
    
    // 2. OPTIMISTIC UPDATE: Update local state immediately
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
    
    // 3. SEND API REQUEST
    try {
      const response = await fetch(`/api/tables/${tableId}/cells`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowKey,
          tableColumnId,
          value,
          // entrySource: 'MANUAL',  // Optional: specify how this was entered
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update cell: ${response.statusText}`);
      }
      
      // Success! The optimistic update was correct
      // Optionally, you could update with the server response
      const result = await response.json();
      console.log('Cell updated successfully:', result);
      
    } catch (error) {
      // 4. ROLLBACK: If the API fails, restore previous state
      console.error('Error updating cell:', error);
      
      set({
        cellData: previousCellData,
        error: error instanceof Error ? error.message : 'Failed to update cell',
      });
      
      // Optionally show a toast notification to the user
      // toast.error('Failed to update cell. Please try again.');
      
      return; // Exit early, don't clear lastUpdatedCell
    }
    
    // 5. CLEAR SUCCESS INDICATOR after animation
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
