/**
 * BaseList Store - Manages BaseLists state
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §1
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { BaseListDTO } from '@/lib/types/models';

/**
 * BaseList Store State
 */
interface BaseListState {
  lists: BaseListDTO[];
  isLoading: boolean;
  error: string | null;
  
  fetchLists: () => Promise<void>;
  setLists: (lists: BaseListDTO[]) => void;
  clearError: () => void;
}

/**
 * Create the BaseList Store
 * With DevTools for debugging
 */
export const useBaseListStore = create<BaseListState>()(
  devtools(
    (set) => ({
      lists: [],
      isLoading: false,
      error: null,
      
      fetchLists: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch('/api/base-lists');
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to fetch lists' }));
            throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch lists`);
          }
          
          const result = await response.json();
          const lists = result.data || [];
          set({ lists, isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          set({ error: errorMessage, isLoading: false });
        }
      },
      
      setLists: (lists) => set({ lists }),
      
      clearError: () => set({ error: null }),
    }),
    { name: 'BaseListStore' }
  )
);
