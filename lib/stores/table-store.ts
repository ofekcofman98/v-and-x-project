/**
 * Table Store - Manages Tables state
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §4
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TableDTO } from '@/lib/types/models';

/**
 * Table Store State
 */
interface TableState {
  tables: TableDTO[];
  isLoading: boolean;
  error: string | null;
  
  fetchTables: () => Promise<void>;
  addTable: (table: TableDTO) => void;
  clearError: () => void;
}

/**
 * Create the Table Store
 * With DevTools for debugging
 */
export const useTableStore = create<TableState>()(
  devtools(
    (set) => ({
      tables: [],
      isLoading: false,
      error: null,
      
      fetchTables: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch('/api/tables');
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to fetch tables' }));
            throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch tables`);
          }
          
          const result = await response.json();
          const tables = result.data || [];
          set({ tables, isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          set({ error: errorMessage, isLoading: false });
        }
      },
      
      addTable: (table) => set((state) => ({ 
        tables: [table, ...state.tables] 
      })),
      
      clearError: () => set({ error: null }),
    }),
    { name: 'TableStore' }
  )
);
