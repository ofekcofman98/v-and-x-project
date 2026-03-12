/**
 * UI Store - Manages UI state including Smart Pointer (Active Cell)
 * Based on: docs/04_STATE_MANAGEMENT.md §2.1
 * Continuous Flow: docs/04_STATE_MANAGEMENT.md §7
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Represents a cell position in the table
 */
export interface CellPosition {
  rowId: string;
  columnId: string;
}

/**
 * Voice recording states following the lifecycle in docs/05_VOICE_PIPELINE.md
 * Includes continuous flow states from docs/06_SMART_POINTER.md §9
 */
export type RecordingState = 
  | 'idle'        // Not recording
  | 'listening'   // Recording audio
  | 'processing'  // Transcribing and parsing
  | 'confirming'  // Waiting for user confirmation
  | 'committing'  // Saving to database
  | 'advancing'   // Advancing pointer (continuous mode)
  | 'error';      // Error occurred

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
  value: string | number | boolean | null;
  confidence: number;
  alternatives?: Array<{ label: string; value: string | number | boolean }>;
}

/**
 * VAD (Voice Activity Detection) sensitivity settings
 * Based on: docs/04_STATE_MANAGEMENT.md §7.2
 */
export interface VADSensitivity {
  /** RMS level (0–255) above which audio is speech. Default: 15 */
  speechThreshold: number;
  /** RMS level below which audio is silence. Default: 8 */
  silenceThreshold: number;
  /** Ms of continuous silence before chunk flushes. Default: 1200 */
  silenceDurationMs: number;
}

/**
 * Default VAD sensitivity values
 */
const defaultVADSensitivity: VADSensitivity = {
  speechThreshold: 15,
  silenceThreshold: 8,
  silenceDurationMs: 1800,
};

/**
 * User preferences (persisted to localStorage)
 * Based on: docs/04_STATE_MANAGEMENT.md §2.1 & §7.2
 */
export interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  showConfidenceScores: boolean;
  autoAdvanceDelay: number;
  voiceFeedbackEnabled: boolean;
  vadSensitivity: VADSensitivity;
}

/**
 * Default UI preferences
 */
const defaultPreferences: UIPreferences = {
  theme: 'system',
  fontSize: 'medium',
  showConfidenceScores: true,
  autoAdvanceDelay: 2000,
  voiceFeedbackEnabled: false,
  vadSensitivity: defaultVADSensitivity,
};

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
  
  // Continuous Flow (docs/04_STATE_MANAGEMENT.md §7)
  /** Whether the VAD continuous loop is active */
  continuousMode: boolean;
  
  // User Preferences (persisted)
  preferences: UIPreferences;
  
  // Actions
  setActiveCell: (cell: CellPosition | null) => void;
  setRecordingState: (state: RecordingState) => void;
  setNavigationMode: (mode: NavigationMode) => void;
  setPendingConfirmation: (confirmation: PendingConfirmation | null) => void;
  
  // Continuous mode actions
  /** Toggle continuous mode on/off */
  setContinuousMode: (enabled: boolean) => void;
  
  // Preferences actions
  updatePreferences: (preferences: Partial<UIPreferences>) => void;
  
  // Voice recording lifecycle actions
  startRecording: () => void;
  stopRecording: () => void;
  setProcessing: () => void;
  setError: (error?: string) => void;
  
  confirmEntry: () => void;
  cancelEntry: () => void;
  resetUI: () => void;
}

/**
 * Create the UI Store
 * With DevTools and persistence for preferences
 */
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        activeCell: null,
        recordingState: 'idle',
        navigationMode: 'column-first',
        pendingConfirmation: null,
        continuousMode: false,
        preferences: defaultPreferences,
        
        // Actions
        setActiveCell: (cell) => set({ activeCell: cell }),
        
        setRecordingState: (state) => set({ recordingState: state }),
        
        setNavigationMode: (mode) => set({ navigationMode: mode }),
        
        setPendingConfirmation: (confirmation) => set({ pendingConfirmation: confirmation }),
        
        // Continuous mode actions
        setContinuousMode: (enabled) => set({ continuousMode: enabled }),
        
        // Preferences actions
        updatePreferences: (prefs) => set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),
        
        // Voice recording lifecycle actions
        startRecording: () => set({ recordingState: 'listening' }),
        
        stopRecording: () => set({ recordingState: 'processing' }),
        
        setProcessing: () => set({ recordingState: 'processing' }),
        
        setError: () => {
          set({ recordingState: 'error' });
          
          setTimeout(() => {
            set({ recordingState: 'idle' });
          }, 3000);
        },
        
        confirmEntry: () => {
          set({ recordingState: 'committing' });
          
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
            continuousMode: false,
          });
        },
      }),
      {
        name: 'vocalgrid-ui-preferences',
        
        // Only persist preferences and navigationMode, not transient state
        // continuousMode is intentionally excluded: microphone must never auto-activate on page load
        partialize: (state) => ({
          preferences: state.preferences,
          navigationMode: state.navigationMode,
        }),
      }
    ),
    { name: 'UIStore' }
  )
);
