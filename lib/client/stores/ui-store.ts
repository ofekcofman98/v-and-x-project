/**
 * UI Store - Manages UI state including Smart Pointer (Active Cell)
 * Based on: docs/04_STATE_MANAGEMENT.md §2.1
 * Continuous Flow: docs/04_STATE_MANAGEMENT.md §7
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { BatchCellWrite } from '@/lib/shared/types/voice-pipeline';
import { voiceTelemetry } from '@/lib/client/hooks/voice/use-voice-telemetry';

/**
 * Represents a cell position in the table
 */
export interface CellPosition {
  rowKey: string;
  tableColumnId: string;
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
  /** Ms of continuous silence before chunk flushes. Default: 700 */
  silenceDurationMs: number;
  /**
   * Soft cap, in ms, on a single chunk's duration. Past this point the
   * chunk flushes at the next brief pause instead of at a full pause,
   * splitting long dictated lists between entries. Default: 15000
   */
  maxChunkMs: number;
  /**
   * Hard ceiling, in ms, on a single chunk's duration — force-flushes
   * pause-free speech that never gives maxChunkMs a natural gap. Default: 30000
   */
  hardMaxChunkMs: number;
}

/**
 * Default VAD sensitivity values.
 * silenceDurationMs was 1800ms — for a short single-word value (e.g. "12")
 * that produced a ~2.5-2.9s blob dominated by trailing silence, which both
 * slowed transcription and increased the odds of Whisper mistaking the
 * ambient tail for speech. 700ms is still comfortably longer than a natural
 * mid-phrase pause (e.g. the comma in "Noa Cohen, 21"). docs/06_SMART_POINTER_LOGS.md
 */
const defaultVADSensitivity: VADSensitivity = {
  speechThreshold: 15,
  silenceThreshold: 8,
  silenceDurationMs: 700,
  maxChunkMs: 15_000,
  hardMaxChunkMs: 30_000,
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

  /**
   * The table the Smart Pointer / voice pipeline currently target.
   * Un-persisted — see setActiveTable. docs/features/16_master_detail_workspace.md §5
   */
  activeTableId: string | null;

  // Voice Recording
  recordingState: RecordingState;
  
  // Navigation
  navigationMode: NavigationMode;
  
  // Confirmation
  pendingConfirmation: PendingConfirmation | null;
  /** requestId of the voice interaction awaiting confirmation, for docs/features/19_voice_telemetry.md. */
  pendingConfirmationRequestId: string | null;

  // Batch Confirmation — sibling to pendingConfirmation rather than a union,
  // so existing single-entry consumers are untouched.
  // docs/features/03_ai_table_agent.md §5
  pendingBatchConfirmation: BatchCellWrite[] | null;
  batchOverflowCount: number;
  /** requestId of the voice interaction that produced the pending batch, for docs/features/19_voice_telemetry.md. */
  pendingBatchRequestId: string | null;

  // Continuous Flow (docs/04_STATE_MANAGEMENT.md §7)
  /** Whether the VAD continuous loop is active */
  continuousMode: boolean;

  // Real-time voice feedback (docs/features/15_realtime_voice_feedback.md §3.4)
  /**
   * The most recent transcript Whisper actually heard, echoed back to the
   * user. Transient — cleared on the next recording start, never persisted.
   */
  lastTranscript: string | null;

  /**
   * Provisional (Web Speech shadow) feedback — the UI's *guess* while the
   * user is still speaking. Never authoritative, never writes a cell.
   * Cleared on speech end, error, mode toggle, and cell change per the
   * reconciliation rules. docs/features/15_realtime_voice_feedback.md §3.2, §4
   */
  provisionalFeedback: {
    interimTranscript: string | null;
    provisionalRowKey: string | null;
    provisionalValue: string | null;
  };

  // User Preferences (persisted)
  preferences: UIPreferences;

  /**
   * Whether agent chat responses auto-play as spoken audio. Session-scoped —
   * intentionally excluded from partialize (same reasoning as
   * continuousMode: mirrors the mic-must-never-auto-activate precedent, here
   * applied to audio-must-never-auto-play-on-reload). Defaults on.
   * docs/features/17-voice-chat-loop.md §6
   */
  voiceOutputEnabled: boolean;

  // Actions
  setActiveCell: (cell: CellPosition | null) => void;

  /**
   * Single owned transition for "the workspace moved to a different table":
   * updates activeTableId and, only when it actually changed, clears the
   * pointer and every piece of in-flight voice/confirmation state so nothing
   * from the previous table leaks into the new one.
   * docs/features/16_master_detail_workspace.md §5
   */
  setActiveTable: (tableId: string | null) => void;
  setRecordingState: (state: RecordingState) => void;
  setNavigationMode: (mode: NavigationMode) => void;
  /** `requestId`, when provided alongside a non-null confirmation, stamps confirm_shown_at (docs/features/19_voice_telemetry.md §7). */
  setPendingConfirmation: (confirmation: PendingConfirmation | null, requestId?: string) => void;

  /** `requestId`, when provided alongside non-empty writes, stamps confirm_shown_at (docs/features/19_voice_telemetry.md §7). */
  setPendingBatchConfirmation: (writes: BatchCellWrite[] | null, overflowCount?: number, requestId?: string) => void;
  updateBatchWrite: (index: number, write: BatchCellWrite) => void;
  removeBatchWrite: (index: number) => void;

  // Continuous mode actions
  /** Toggle continuous mode on/off */
  setContinuousMode: (enabled: boolean) => void;

  /** Set (or clear, with null) the most recently heard transcript */
  setLastTranscript: (transcript: string | null) => void;

  /** Merge partial provisional feedback fields (interim transcript and/or guessed target) */
  setProvisionalFeedback: (
    feedback: Partial<UIState['provisionalFeedback']>
  ) => void;
  /** Clear all provisional feedback fields back to null */
  clearProvisionalFeedback: () => void;

  // Preferences actions
  updatePreferences: (preferences: Partial<UIPreferences>) => void;

  /** Toggle spoken auto-playback of agent chat responses on/off. */
  setVoiceOutputEnabled: (enabled: boolean) => void;

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
        activeTableId: null,
        recordingState: 'idle',
        navigationMode: 'column-first',
        pendingConfirmation: null,
        pendingConfirmationRequestId: null,
        pendingBatchConfirmation: null,
        batchOverflowCount: 0,
        pendingBatchRequestId: null,
        continuousMode: false,
        lastTranscript: null,
        provisionalFeedback: {
          interimTranscript: null,
          provisionalRowKey: null,
          provisionalValue: null,
        },
        preferences: defaultPreferences,
        voiceOutputEnabled: true,

        // Actions
        setActiveCell: (cell) => set({ activeCell: cell }),

        setActiveTable: (tableId) =>
          set((state) => {
            if (state.activeTableId === tableId) return { activeTableId: tableId };
            return {
              activeTableId: tableId,
              activeCell: null,
              pendingConfirmation: null,
              pendingConfirmationRequestId: null,
              pendingBatchConfirmation: null,
              batchOverflowCount: 0,
              pendingBatchRequestId: null,
              continuousMode: false,
              recordingState: 'idle',
              lastTranscript: null,
              provisionalFeedback: {
                interimTranscript: null,
                provisionalRowKey: null,
                provisionalValue: null,
              },
            };
          }),

        setRecordingState: (state) => set({ recordingState: state }),
        
        setNavigationMode: (mode) => set({ navigationMode: mode }),
        
        setPendingConfirmation: (confirmation, requestId) => {
          // docs/features/19_voice_telemetry.md §7 — confirm_shown_at.
          if (confirmation && requestId) {
            voiceTelemetry.mark(requestId, 'confirmShownAt');
          }
          set({
            pendingConfirmation: confirmation,
            pendingConfirmationRequestId: confirmation ? (requestId ?? null) : null,
          });
        },

        setPendingBatchConfirmation: (writes, overflowCount = 0, requestId) => {
          // docs/features/19_voice_telemetry.md §7 — confirm_shown_at.
          if (writes && writes.length > 0 && requestId) {
            voiceTelemetry.mark(requestId, 'confirmShownAt');
          }
          set({
            pendingBatchConfirmation: writes,
            batchOverflowCount: overflowCount,
            pendingBatchRequestId: writes && writes.length > 0 ? (requestId ?? null) : null,
          });
        },

        updateBatchWrite: (index, write) =>
          set((state) => {
            if (!state.pendingBatchConfirmation) return state;
            const writes = [...state.pendingBatchConfirmation];
            writes[index] = write;
            return { pendingBatchConfirmation: writes };
          }),

        removeBatchWrite: (index) =>
          set((state) => {
            if (!state.pendingBatchConfirmation) return state;
            const writes = state.pendingBatchConfirmation.filter((_, i) => i !== index);

            if (writes.length === 0) {
              // Every entry was dismissed — nothing left to commit.
              // docs/features/19_voice_telemetry.md §7 — flush on abandon.
              if (state.pendingBatchRequestId) {
                voiceTelemetry.setConfirmationRoute(state.pendingBatchRequestId, 'abandoned');
                voiceTelemetry.flush(state.pendingBatchRequestId);
              }
              return { pendingBatchConfirmation: null, pendingBatchRequestId: null };
            }

            return { pendingBatchConfirmation: writes };
          }),

        // Continuous mode actions
        setContinuousMode: (enabled) => set({ continuousMode: enabled }),

        setLastTranscript: (transcript) => set({ lastTranscript: transcript }),

        setProvisionalFeedback: (feedback) =>
          set((state) => ({
            provisionalFeedback: { ...state.provisionalFeedback, ...feedback },
          })),

        clearProvisionalFeedback: () =>
          set({
            provisionalFeedback: {
              interimTranscript: null,
              provisionalRowKey: null,
              provisionalValue: null,
            },
          }),

        // Preferences actions
        updatePreferences: (prefs) => set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

        setVoiceOutputEnabled: (enabled) => set({ voiceOutputEnabled: enabled }),

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
          set((state) => {
            // docs/features/19_voice_telemetry.md §7, §12 — confirm_received_at.
            // No cell mutation happens here (Constraint 2) — this is the
            // interaction's terminal point for the single-entry confirm route.
            const requestId = state.pendingConfirmationRequestId;
            if (requestId) {
              voiceTelemetry.mark(requestId, 'confirmReceivedAt');
              voiceTelemetry.setConfirmationRoute(requestId, 'confirmed');
              voiceTelemetry.flush(requestId);
            }
            return { recordingState: 'committing' };
          });

          setTimeout(() => {
            set({
              recordingState: 'idle',
              pendingConfirmation: null,
              pendingConfirmationRequestId: null,
            });
          }, 500);
        },

        cancelEntry: () => {
          set((state) => {
            // docs/features/19_voice_telemetry.md §7 — flush on abandon.
            const requestId = state.pendingConfirmationRequestId;
            if (requestId) {
              voiceTelemetry.setConfirmationRoute(requestId, 'abandoned');
              voiceTelemetry.flush(requestId);
            }
            return {
              recordingState: 'idle',
              pendingConfirmation: null,
              pendingConfirmationRequestId: null,
            };
          });
        },
        
        resetUI: () => {
          set({
            activeCell: null,
            activeTableId: null,
            recordingState: 'idle',
            navigationMode: 'column-first',
            pendingConfirmation: null,
            pendingConfirmationRequestId: null,
            pendingBatchConfirmation: null,
            batchOverflowCount: 0,
            pendingBatchRequestId: null,
            continuousMode: false,
            lastTranscript: null,
            provisionalFeedback: {
              interimTranscript: null,
              provisionalRowKey: null,
              provisionalValue: null,
            },
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
