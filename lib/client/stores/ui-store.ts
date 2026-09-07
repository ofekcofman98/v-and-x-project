/**
 * UI Store - Manages UI state including Smart Pointer (Active Cell)
 * Based on: docs/04_STATE_MANAGEMENT.md §2.1
 * Continuous Flow: docs/04_STATE_MANAGEMENT.md §7
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { BatchCellWrite, NavigationMode } from '@/lib/shared/types/voice-pipeline';
import { voiceTelemetry } from '@/lib/client/hooks/voice/use-voice-telemetry';
import { cellKey } from '@/lib/client/stores/table-cell-store';

/**
 * Represents a cell position in the table
 */
export interface CellPosition {
  rowKey: string;
  tableColumnId: string;
}

/**
 * A drag/Shift-extended selection, anchor/focus convention (matches native
 * text selection). docs/features/20_interactive_grid_selection.md §5
 */
export interface SelectionRange {
  anchor: CellPosition;
  focus: CellPosition;
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
 * Navigation mode for Smart Pointer advancement.
 * Re-exported from lib/shared/types/voice-pipeline.ts, the single source of
 * truth, so existing import sites of this store keep working unchanged.
 * Based on: docs/06_SMART_POINTER.md §3.1
 */
export type { NavigationMode };

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
 * ambient tail for speech. Tightened to 550ms per
 * docs/features/19_voice_telemetry.md's measured P50 recording duration, but
 * that cut off real batch dictation: a natural breath/glance pause between
 * entries in "Monica Geller, 23. [pause] Rachel Green, 74" is comfortably
 * longer than 550ms and got flushed as two separate interactions. Bumped to
 * 700ms, still not enough margin for that same pause in practice — settled
 * at 800ms for a safer cushion, still well under the original 1800ms.
 */
const defaultVADSensitivity: VADSensitivity = {
  speechThreshold: 15,
  silenceThreshold: 8,
  silenceDurationMs: 800,
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

  // Multi-cell Selection (docs/features/20_interactive_grid_selection.md §5)
  // Additive to activeCell, never a replacement for it — activeCell keeps
  // its single-cell meaning everywhere else (voice pipeline, nav, etc.).
  /** anchor/focus of the current drag or Shift-extended selection; null when
   *  there is no selection (a plain click clears this). */
  selectionRange: SelectionRange | null;
  /** cellKey()s for every cell inside selectionRange's rectangle — the
   *  per-cell subscription surface (mirrors justUpdatedCellKeys' shape).
   *  Empty for a 1-cell range: a bare click shows only the active-cell
   *  highlight, not a redundant 1-cell "selection". */
  selectedKeys: Set<string>;
  /** Row/column id order registered by DataTable so selection actions can
   *  resolve an anchor/focus pair into a rectangle. Transient, not persisted. */
  gridOrder: { rowIds: string[]; columnIds: string[] };

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
  /** Trailing segment segmentation couldn't resolve into a pair/group (e.g. a
   *  dangling name with no value spoken after it) — surfaced instead of
   *  silently dropped. Null when the whole transcript segmented cleanly. */
  batchUnparsedRemainder: string | null;
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

  // Selection actions (docs/features/20_interactive_grid_selection.md §5)
  /** Register the current row/column id order — call whenever the table
   *  schema changes, so selection rectangles resolve against fresh indices. */
  setGridOrder: (rowIds: string[], columnIds: string[]) => void;
  setSelectionRange: (range: SelectionRange | null) => void;
  /** Extend the in-progress selection's focus to `to`, keeping the anchor.
   *  Starts a new 1-cell range (anchor = focus = `to`) if none exists yet. */
  extendSelection: (to: CellPosition) => void;
  clearSelection: () => void;

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
  setPendingBatchConfirmation: (
    writes: BatchCellWrite[] | null,
    overflowCount?: number,
    requestId?: string,
    unparsedRemainder?: string | null
  ) => void;
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
 * Resolve an anchor/focus selection into every CellPosition inside the
 * rectangle they describe, using the registered grid order to find each
 * cell's row/column index. Returns [] for a 1-cell range (spec §5 — no
 * visually distinct 1-cell "selection") or when either endpoint isn't
 * found in gridOrder (e.g. stale schema mid-transition).
 *
 * Exported (not just used internally for selectedKeys) so consumers that
 * need the selection as writable targets — e.g. delete-to-clear
 * (docs/features/20_interactive_grid_selection.md §6) — resolve the exact
 * same rectangle instead of re-deriving it or parsing cellKey() strings.
 */
export function resolveSelectionCells(
  range: SelectionRange,
  gridOrder: { rowIds: string[]; columnIds: string[] }
): CellPosition[] {
  const anchorRowIdx = gridOrder.rowIds.indexOf(range.anchor.rowKey);
  const focusRowIdx = gridOrder.rowIds.indexOf(range.focus.rowKey);
  const anchorColIdx = gridOrder.columnIds.indexOf(range.anchor.tableColumnId);
  const focusColIdx = gridOrder.columnIds.indexOf(range.focus.tableColumnId);

  if (anchorRowIdx === -1 || focusRowIdx === -1 || anchorColIdx === -1 || focusColIdx === -1) {
    return [];
  }

  const isSingleCell = anchorRowIdx === focusRowIdx && anchorColIdx === focusColIdx;
  if (isSingleCell) {
    return [];
  }

  const minRow = Math.min(anchorRowIdx, focusRowIdx);
  const maxRow = Math.max(anchorRowIdx, focusRowIdx);
  const minCol = Math.min(anchorColIdx, focusColIdx);
  const maxCol = Math.max(anchorColIdx, focusColIdx);

  const cells: CellPosition[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      cells.push({ rowKey: gridOrder.rowIds[r], tableColumnId: gridOrder.columnIds[c] });
    }
  }
  return cells;
}

function resolveSelectedKeys(
  range: SelectionRange,
  gridOrder: { rowIds: string[]; columnIds: string[] }
): Set<string> {
  return new Set(
    resolveSelectionCells(range, gridOrder).map((cell) => cellKey(cell.rowKey, cell.tableColumnId))
  );
}

/**
 * Create the UI Store
 * With DevTools and persistence for preferences
 */
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        activeCell: null,
        selectionRange: null,
        selectedKeys: new Set<string>(),
        gridOrder: { rowIds: [], columnIds: [] },
        activeTableId: null,
        recordingState: 'idle',
        navigationMode: 'column-first',
        pendingConfirmation: null,
        pendingConfirmationRequestId: null,
        pendingBatchConfirmation: null,
        batchOverflowCount: 0,
        batchUnparsedRemainder: null,
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
        // Clears any existing selection — matches spec §5: a plain move of
        // the single pointer (click, arrow, voice) is not a range op.
        // Shift+Click/Shift+Arrow call extendSelection instead of this.
        setActiveCell: (cell) =>
          set({ activeCell: cell, selectionRange: null, selectedKeys: new Set() }),

        setGridOrder: (rowIds, columnIds) => set({ gridOrder: { rowIds, columnIds } }),

        setSelectionRange: (range) =>
          set({
            selectionRange: range,
            selectedKeys: range ? resolveSelectedKeys(range, get().gridOrder) : new Set(),
          }),

        extendSelection: (to) => {
          const { selectionRange, activeCell, gridOrder } = get();
          const anchor = selectionRange?.anchor ?? activeCell ?? to;
          const range: SelectionRange = { anchor, focus: to };
          set({ selectionRange: range, selectedKeys: resolveSelectedKeys(range, gridOrder) });
        },

        clearSelection: () => set({ selectionRange: null, selectedKeys: new Set() }),

        setActiveTable: (tableId) =>
          set((state) => {
            if (state.activeTableId === tableId) return { activeTableId: tableId };
            return {
              activeTableId: tableId,
              activeCell: null,
              selectionRange: null,
              selectedKeys: new Set(),
              pendingConfirmation: null,
              pendingConfirmationRequestId: null,
              pendingBatchConfirmation: null,
              batchOverflowCount: 0,
        batchUnparsedRemainder: null,
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

        setPendingBatchConfirmation: (writes, overflowCount = 0, requestId, unparsedRemainder = null) => {
          // docs/features/19_voice_telemetry.md §7 — confirm_shown_at.
          if (writes && writes.length > 0 && requestId) {
            voiceTelemetry.mark(requestId, 'confirmShownAt');
          }
          set({
            pendingBatchConfirmation: writes,
            batchOverflowCount: overflowCount,
            batchUnparsedRemainder: unparsedRemainder,
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
              return { pendingBatchConfirmation: null, pendingBatchRequestId: null, batchUnparsedRemainder: null };
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
            selectionRange: null,
            selectedKeys: new Set(),
            activeTableId: null,
            recordingState: 'idle',
            navigationMode: 'column-first',
            pendingConfirmation: null,
            pendingConfirmationRequestId: null,
            pendingBatchConfirmation: null,
            batchOverflowCount: 0,
        batchUnparsedRemainder: null,
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
