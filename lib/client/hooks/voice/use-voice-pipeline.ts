/**
 * useVoicePipeline Hook
 * Orchestrates the complete voice input pipeline for VoiceButtonInner.
 * Absorbs all business logic from VoiceButton so the component body is
 * reduced to purely declarative JSX.
 * Based on: docs/05_VOICE_PIPELINE.md §2.2, §9 and docs/06_SMART_POINTER.md §9
 */

import { useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useVoiceEntry } from '@/lib/client/hooks/voice/use-voice-entry';
import { useContinuousVoice } from '@/lib/client/hooks/voice/use-continuous-voice';
import { voiceTelemetry } from '@/lib/client/hooks/voice/use-voice-telemetry';
import { useVoiceActionHandler } from '@/lib/client/hooks/voice/use-voice-action-handler';
import { useVoiceBatchHandler } from '@/lib/client/hooks/voice/use-voice-batch-handler';
import { useVoiceErrorHandler } from '@/lib/client/hooks/voice/use-voice-error-handler';
import { useSpeechShadow } from '@/lib/client/hooks/voice/use-speech-shadow';
import { useProvisionalTarget } from '@/lib/client/hooks/voice/use-provisional-target';
import { toast } from '@/components/ui/use-toast';
import type { VoiceEntryResult, VoiceBatchResult } from '@/lib/shared/types/voice-pipeline';
import { isVoiceBatchResult } from '@/lib/shared/types/voice-pipeline';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import { VoiceErrors, VoiceInputError } from '@/lib/shared/types/voice-errors';
import { trackVoiceMetrics } from '@/lib/shared/monitoring/voice-metrics';

export interface UseVoicePipelineOptions {
  tableId: string;
  tableSchema: TableSchema;
  /**
   * Primitive boolean derived by VoiceButtonShell — avoids subscribing to the full
   * CellPosition object and eliminates re-renders on row-to-row cell navigation.
   */
  hasActiveCell: boolean;
}

export interface UseVoicePipelineReturn {
  /** true only when continuous mode is active AND recording state is 'listening' */
  isListening: boolean;
  isProcessing: boolean;
  isError: boolean;
  isConfirming: boolean;
  isCommitting: boolean;
  isAdvancing: boolean;
  continuousMode: boolean;
  /** Merged audio level from manual or VAD recorder, clamped to [0, 1] */
  visualLevel: number;
  /** Most recent transcript Whisper actually heard, or null before the first entry / after a reset */
  lastTranscript: string | null;
  /** Provisional (Web Speech shadow) transcript, growing live while speaking — null when unsupported or idle */
  provisionalTranscript: string | null;
  /** Stable toggle handler — activates or deactivates continuous mode */
  handleToggle: () => Promise<void>;
  /** Derived tooltip string based on current state flags */
  tooltipText: string;
}

export function useVoicePipeline({
  tableId,
  tableSchema,
  hasActiveCell,
}: UseVoicePipelineOptions): UseVoicePipelineReturn {
  // Only the two state slices that directly drive VoiceButtonInner re-renders.
  // activeCell, navigationMode are read imperatively inside callbacks.
  const recordingState = useUIStore((s) => s.recordingState);
  const continuousMode = useUIStore((s) => s.continuousMode);
  const lastTranscript = useUIStore((s) => s.lastTranscript);
  // navigationMode changes rarely (explicit user toggle) — cheap to subscribe
  // directly, unlike activeCell which changes on every pointer advance.
  const navigationMode = useUIStore((s) => s.navigationMode);
  const provisionalTranscript = useUIStore((s) => s.provisionalFeedback.interimTranscript);

  // Stable action dispatchers — Zustand guarantees these never change.
  const setRecordingState = useUIStore((s) => s.setRecordingState);
  const setPendingConfirmation = useUIStore((s) => s.setPendingConfirmation);
  const setContinuousMode = useUIStore((s) => s.setContinuousMode);
  const setLastTranscript = useUIStore((s) => s.setLastTranscript);

  const autoRestartTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Holds the latest stopContinuous reference so onEndOfTable can invoke it without
  // capturing a stale closure.
  const stopContinuousRef = useRef<(() => void) | null>(null);

  const resetToIdle = useCallback(() => {
    setRecordingState('idle');
  }, [setRecordingState]);

  const { dispatchError } = useVoiceErrorHandler({ onResetToIdle: resetToIdle });

  // Stable callback so useVoiceActionHandler's handleParsedResult dep array is unaffected.
  const onEndOfTable = useCallback(() => {
    stopContinuousRef.current?.();
  }, []);

  const { handleParsedResult } = useVoiceActionHandler({
    tableId,
    tableSchema,
    onEndOfTable,
  });

  // confirmBatch/resolveDisambiguation/dismissWrite are consumed directly by
  // BatchConfirmationStrip (its own useVoiceBatchHandler instance, same
  // store) — only the result-routing callback is needed here.
  const { handleBatchResult } = useVoiceBatchHandler({
    tableId,
    tableSchema,
    onEndOfTable,
  });

  /**
   * Sends a manual recording through the voice-entry API and delegates result
   * handling to useVoiceActionHandler.
   * Reads activeCell and navigationMode imperatively — no subscription required.
   */
  const processVoiceEntry = useCallback(
    async (audioBlob: Blob, requestId: string) => {
      const { activeCell, navigationMode } = useUIStore.getState();

      if (!activeCell) {
        throw VoiceErrors.NO_CELL_SELECTED;
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('tableSchema', JSON.stringify(tableSchema));
      formData.append('activeCell', JSON.stringify(activeCell));
      formData.append('navigationMode', navigationMode);
      formData.append('tableId', tableId);
      formData.append('request_id', requestId);

      const startTime = Date.now();
      const response = await fetch('/api/voice-entry', {
        method: 'POST',
        body: formData,
      });
      // docs/features/19_voice_telemetry.md §7 — response-received, not
      // upload-bytes-flushed (documented limitation, see §9).
      voiceTelemetry.mark(requestId, 'uploadCompleteAt');

      const duration = Date.now() - startTime;
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        const errorCode = (payload.error?.code as string) ?? 'VOICE_ENTRY_FAILED';
        const errorMessage = (payload.error?.message as string) ?? 'Voice entry failed';

        trackVoiceMetrics({ phase: 'voice-entry', duration, success: false, error: errorMessage });

        if (response.status === 429) {
          throw VoiceErrors.STT_RATE_LIMIT;
        }

        throw new VoiceInputError(errorCode, errorMessage, true);
      }

      const data = payload.data as VoiceEntryResult | VoiceBatchResult;
      voiceTelemetry.merge(requestId, data.telemetry);

      // Echo what Whisper actually heard before any batch/single-entry fork or
      // error branch below — a failed match is exactly when the user most
      // needs to see the transcript. docs/features/15_realtime_voice_feedback.md §3.4
      setLastTranscript(data.transcript);

      if (isVoiceBatchResult(data)) {
        trackVoiceMetrics({ phase: 'voice-entry', duration, success: true });
        handleBatchResult(data, requestId);
        return;
      }

      const parsed = data;

      if (parsed.action === 'AMBIGUOUS') {
        trackVoiceMetrics({ phase: 'voice-entry', duration, success: false, error: 'Ambiguous match' });
        throw VoiceErrors.PARSE_AMBIGUOUS;
      }

      if (parsed.action === 'ERROR' || !parsed.valueValid) {
        trackVoiceMetrics({
          phase: 'voice-entry',
          duration,
          success: false,
          error: parsed.error ?? 'Invalid value',
        });

        if (!parsed.entity) throw VoiceErrors.PARSE_NO_MATCH;
        if (!parsed.valueValid) throw VoiceErrors.PARSE_INVALID_VALUE;

        throw new VoiceInputError(
          'PARSE_ERROR',
          parsed.error ?? parsed.reasoning ?? 'Could not parse command',
          true
        );
      }

      trackVoiceMetrics({ phase: 'voice-entry', duration, success: true });
      await handleParsedResult(parsed, requestId);
    },
    [tableId, tableSchema, handleParsedResult, handleBatchResult, setLastTranscript]
  );

  /**
   * Callback for useVoiceEntry — invoked when a manual recording blob is ready.
   */
  const handleAudioReady = useCallback(
    async (audioBlob: Blob, requestId: string) => {
      setPendingConfirmation(null);
      setLastTranscript(null);
      setRecordingState('processing');

      const totalStartTime = Date.now();

      try {
        await processVoiceEntry(audioBlob, requestId);

        const totalDuration = Date.now() - totalStartTime;
        trackVoiceMetrics({ phase: 'total', duration: totalDuration, success: true });
      } catch (error) {
        const totalDuration = Date.now() - totalStartTime;
        // docs/features/19_voice_telemetry.md §7 — flush on abandon, client-side error catch.
        voiceTelemetry.setConfirmationRoute(requestId, 'abandoned');
        voiceTelemetry.flush(requestId);
        dispatchError(error, { phase: 'voice-entry', durationMs: totalDuration });
      }
    },
    [processVoiceEntry, dispatchError, setPendingConfirmation, setLastTranscript, setRecordingState]
  );

  /**
   * Shared error handler for both manual recording and VAD-based capture.
   */
  const handleVoiceError = useCallback(
    (error: unknown) => {
      dispatchError(error, { phase: 'recording' });
    },
    [dispatchError]
  );

  const { audioLevel } = useVoiceEntry({
    onAudioReady: handleAudioReady,
    onError: handleVoiceError,
  });

  const { startContinuous, stopContinuous, volume: continuousAudioLevel } = useContinuousVoice({
    tableId,
    tableSchema,
    onResult: handleParsedResult,
    onBatchResult: handleBatchResult,
    onError: handleVoiceError,
  });

  // Keep the ref in sync so onEndOfTable always calls the latest stopContinuous.
  useEffect(() => {
    stopContinuousRef.current = stopContinuous;
  }, [stopContinuous]);

  /**
   * Stop any in-flight recording when the active table changes or this
   * surface unmounts. Without this, a running VAD session's onSpeechEnd
   * callback (captured at startVAD time) would still POST audio against the
   * table it started on — masked today only because every table switch is a
   * full page navigation. docs/features/16_master_detail_workspace.md §5
   */
  const previousTableIdRef = useRef(tableId);
  useEffect(() => {
    if (previousTableIdRef.current !== tableId) {
      stopContinuousRef.current?.();
      setContinuousMode(false);
      previousTableIdRef.current = tableId;
    }

    return () => {
      stopContinuousRef.current?.();
    };
  }, [tableId, setContinuousMode]);

  /**
   * Auto-restart continuous listening after the pointer advances.
   * Reads fresh store state inside the timer to avoid stale-closure infinite loops.
   */
  useEffect(() => {
    if (recordingState !== 'advancing') return;

    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current);
    }

    autoRestartTimerRef.current = setTimeout(() => {
      const { continuousMode: freshContinuous, recordingState: freshRecording } =
        useUIStore.getState();

      if (freshContinuous && freshRecording === 'advancing') {
        setRecordingState('listening');
      }

      autoRestartTimerRef.current = null;
    }, 400);

    return () => {
      if (autoRestartTimerRef.current) {
        clearTimeout(autoRestartTimerRef.current);
        autoRestartTimerRef.current = null;
      }
    };
  }, [recordingState, setRecordingState]);

  /**
   * Escape key exits continuous mode from anywhere on the page.
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && continuousMode) {
        e.preventDefault();
        stopContinuous();
        setContinuousMode(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [continuousMode, stopContinuous, setContinuousMode]);

  /**
   * Toggles continuous mode on or off.
   * Uses hasActiveCell prop for the guard — no activeCell subscription required.
   */
  const handleToggle = useCallback(async () => {
    if (continuousMode) {
      stopContinuous();
      setContinuousMode(false);
    } else {
      if (!hasActiveCell) {
        toast({
          title: 'No Cell Selected',
          description: 'Please click on a cell in the table before activating voice input.',
          variant: 'destructive',
          duration: 3000,
        });
        return;
      }

      setContinuousMode(true);
      await startContinuous();
    }
  }, [continuousMode, hasActiveCell, stopContinuous, setContinuousMode, startContinuous]);

  // ── Derived render values ────────────────────────────────────────────────────

  const isListening = continuousMode && recordingState === 'listening';
  const isProcessing = recordingState === 'processing';
  const isError = recordingState === 'error';
  const isConfirming = recordingState === 'confirming';
  const isCommitting = recordingState === 'committing';
  const isAdvancing = recordingState === 'advancing';

  const currentDisplayLevel = continuousMode ? continuousAudioLevel : audioLevel;
  const visualLevel = Math.max(0, Math.min(1, currentDisplayLevel ?? 0));

  // ── Provisional (Web Speech shadow) layer ───────────────────────────────────
  // Restarted per-utterance (on every listening-state edge, not once per
  // continuous session) so each utterance's interim transcript starts clean —
  // otherwise Web Speech's running transcript would keep accumulating across
  // utterances and extractEntityQuick's anchored regex would stop matching.
  // docs/features/15_realtime_voice_feedback.md §3.2, §4
  const speechShadow = useSpeechShadow();

  useEffect(() => {
    if (isListening) {
      speechShadow.start();
    } else {
      speechShadow.stop();
    }
    // speechShadow's start/stop identities are stable (useCallback, no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  useProvisionalTarget({
    interimTranscript: speechShadow.interimTranscript,
    tableSchema,
    navigationMode,
    isActive: isListening && speechShadow.isSupported,
  });

  const tooltipText = (() => {
    if (isProcessing || isConfirming) return 'Processing...';
    if (continuousMode) return 'Continuous mode active - Press ESC to stop';
    if (!hasActiveCell) return 'Select a cell first, then click to activate voice input';
    return 'Click to activate continuous mode';
  })();

  return {
    isListening,
    isProcessing,
    isError,
    isConfirming,
    isCommitting,
    isAdvancing,
    continuousMode,
    visualLevel,
    lastTranscript,
    provisionalTranscript,
    handleToggle,
    tooltipText,
  };
}
