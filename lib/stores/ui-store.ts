/**
 * UI Store - Manages UI state including Smart Pointer (Active Cell)
 * Based on: docs/04_STATE_MANAGEMENT.md §2.1
 */

import { create } from 'zustand';

/**
 * Represents a cell position in the table
 */
export interface CellPosition {
  rowId: string;
  columnId: string;
}

/**
 * Voice recording states following the lifecycle in docs/05_VOICE_PIPELINE.md
 */
export type RecordingState = 
  | 'idle'        // Not recording
  | 'listening'   // Recording audio
  | 'processing'  // Transcribing and parsing
  | 'confirming'  // Waiting for user confirmation
  | 'committing'; // Saving to database

/**
 * Navigation mode for Smart Pointer advancement
 * Based on: docs/06_SMART_POINTER.md §3.1
 */
export type NavigationMode = 'column-first' | 'row-first';

/**
 * Pending confirmation data structure
 */
export interface PendingConfirmation {
  entity: string;
  value: string | number | boolean;
  confidence: number;
  alternatives?: Array<{ label: string; value: string | number | boolean }>;
}

/**
 * UI Store State
 */
interface UIState {
  // Smart Pointer
  activeCell: CellPosition | null;
  
  // Voice Recording
  recordingState: RecordingState;
  
  // Navigation
  navigationMode: NavigationMode;
  
  // Confirmation
  pendingConfirmation: PendingConfirmation | null;
  
  // Actions
  setActiveCell: (cell: CellPosition | null) => void;
  setRecordingState: (state: RecordingState) => void;
  setNavigationMode: (mode: NavigationMode) => void;
  setPendingConfirmation: (confirmation: PendingConfirmation | null) => void;
  confirmEntry: () => void;
  cancelEntry: () => void;
  resetUI: () => void;
}

/**
 * Create the UI Store
 */
export const useUIStore = create<UIState>((set) => ({
  // Initial state
  activeCell: null,
  recordingState: 'idle',
  navigationMode: 'column-first',
  pendingConfirmation: null,
  
  // Actions
  setActiveCell: (cell) => set({ activeCell: cell }),
  
  setRecordingState: (state) => set({ recordingState: state }),
  
  setNavigationMode: (mode) => set({ navigationMode: mode }),
  
  setPendingConfirmation: (confirmation) => set({ pendingConfirmation: confirmation }),
  
  confirmEntry: () => {
    // Set to committing state, then reset
    set({ recordingState: 'committing' });
    
    // Simulate commit (will be replaced with actual mutation)
    setTimeout(() => {
      set({
        recordingState: 'idle',
        pendingConfirmation: null,
      });
    }, 500);
  },
  
  cancelEntry: () => {
    set({
      recordingState: 'idle',
      pendingConfirmation: null,
    });
  },
  
  resetUI: () => {
    set({
      activeCell: null,
      recordingState: 'idle',
      navigationMode: 'column-first',
      pendingConfirmation: null,
    });
  },
}));
