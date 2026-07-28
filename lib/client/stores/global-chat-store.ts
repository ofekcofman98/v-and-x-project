/**
 * Global Chat Store - UI state for the Global Agent chat panel.
 *
 * Mirrors grid-chat-store.ts, but this is one global conversation (no
 * per-tableId reset) — instead the conversation resets whenever the active
 * `@BaseList` mention changes, since switching BaseLists changes the whole
 * data scope the chat is grounded in.
 */

import { create } from 'zustand';
import type { Mention, PendingGlobalAction } from '@/lib/shared/types/ai';

const MAX_HISTORY = 20;

export interface GlobalChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GlobalChatState {
  isOpen: boolean;
  activeMention: Mention | null;
  messages: GlobalChatMessage[];
  pendingAction: PendingGlobalAction | null;
  isConfirmDialogOpen: boolean;

  open: () => void;
  close: () => void;
  setActiveMention: (mention: Mention) => void;
  appendMessage: (message: GlobalChatMessage) => void;
  setPendingAction: (action: PendingGlobalAction) => void;
  clearPendingAction: () => void;
}

export const useGlobalChatStore = create<GlobalChatState>((set, get) => ({
  isOpen: false,
  activeMention: null,
  messages: [],
  pendingAction: null,
  isConfirmDialogOpen: false,

  open: () => set({ isOpen: true }),

  close: () => set({ isOpen: false }),

  setActiveMention: (mention) => {
    const isSameMention = get().activeMention?.id === mention.id;
    set({
      activeMention: mention,
      ...(isSameMention ? {} : { messages: [], pendingAction: null, isConfirmDialogOpen: false }),
    });
  },

  appendMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message].slice(-MAX_HISTORY) })),

  setPendingAction: (action) => set({ pendingAction: action, isConfirmDialogOpen: true }),

  clearPendingAction: () => set({ pendingAction: null, isConfirmDialogOpen: false }),
}));
