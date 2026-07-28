/**
 * Grid Chat Store - UI state for the Grid Agent chat panel
 * Implements: docs/features/03_ai_table_agent.md §4.
 *
 * No persistence — chat history is scoped to one table's current session,
 * same reasoning as table-cell-store.ts not persisting cell data.
 */

import { create } from 'zustand';
import type { PendingGridAction } from '@/lib/shared/types/ai';

const MAX_HISTORY = 20;

export interface GridChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GridChatState {
  isOpen: boolean;
  tableId: string | null;
  messages: GridChatMessage[];
  pendingAction: PendingGridAction | null;
  isConfirmDialogOpen: boolean;

  open: (tableId: string) => void;
  close: () => void;
  appendMessage: (message: GridChatMessage) => void;
  setPendingAction: (action: PendingGridAction) => void;
  clearPendingAction: () => void;
}

export const useGridChatStore = create<GridChatState>((set, get) => ({
  isOpen: false,
  tableId: null,
  messages: [],
  pendingAction: null,
  isConfirmDialogOpen: false,

  open: (tableId) => {
    const isSameTable = get().tableId === tableId;
    set({
      isOpen: true,
      tableId,
      ...(isSameTable ? {} : { messages: [], pendingAction: null, isConfirmDialogOpen: false }),
    });
  },

  close: () => set({ isOpen: false }),

  appendMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message].slice(-MAX_HISTORY) })),

  setPendingAction: (action) => set({ pendingAction: action, isConfirmDialogOpen: true }),

  clearPendingAction: () => set({ pendingAction: null, isConfirmDialogOpen: false }),
}));
