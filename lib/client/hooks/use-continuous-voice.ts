/**
 * useContinuousVoice Hook
 * Wraps VAD and plugs it into the voice pipeline for continuous flow mode
 * Based on: docs/05_VOICE_PIPELINE.md §9.3
 */

import { useCallback, useRef } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useVAD } from '@/lib/client/hooks/use-vad';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { ParsedResult } from '@/lib/shared/types/voice-pipeline';

interface UseContinuousVoiceOptions {
  tableSchema: TableSchema;
  onResult: (result: ParsedResult) => void;
  onError: (error: Error) => void;
}

/**
 * Continuous voice input hook
 * Automatically detects speech, processes it through the voice pipeline,
 * and returns to listening after each entry
 */
export function useContinuousVoice({
  tableSchema,
  onResult,
  onError,
}: UseContinuousVoiceOptions) {
  // VAD sensitivity must remain a reactive subscription — changes to these preferences
  // must propagate to useVAD so the audio pipeline reinitialises with the new thresholds.
  const vadSensitivity = useUIStore((s) => s.preferences.vadSensitivity);
  const setRecordingState = useUIStore((s) => s.setRecordingState);

  // activeCell and navigationMode are read imperatively inside handleChunk via
  // useUIStore.getState() — avoids re-creating the callback on every cell-selection change.

  // Initialize VAD with user preferences
  const { startVAD, stopVAD, volume } = useVAD({
    speechThreshold: vadSensitivity.speechThreshold,
    silenceThreshold: vadSensitivity.silenceThreshold,
    silenceDurationMs: vadSensitivity.silenceDurationMs,
    speechDebounceMs: 150,
    maxChunkMs: 15_000,
  });

  const isContinuousRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const MAX_CONSECUTIVE_FAILURES = 3;

  /**
   * Process a complete audio chunk through the voice pipeline.
   * Called by VAD when speech ends.
   * Reads activeCell and navigationMode imperatively at call time so this callback
   * is stable across all cell-selection changes.
   */
  const handleChunk = useCallback(
    async (audioBlob: Blob) => {
      if (!isContinuousRef.current) return;

      // Read volatile state imperatively — no stale-closure risk, no re-render on change
      const { activeCell, navigationMode } = useUIStore.getState();

      if (!activeCell) {
        setRecordingState('listening');
        return;
      }

      try {
        setRecordingState('processing');

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('tableSchema', JSON.stringify(tableSchema));
        formData.append('activeCell', JSON.stringify(activeCell));
        formData.append('navigationMode', navigationMode);

        const response = await fetch('/api/voice-entry', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Voice entry failed: ${response.statusText}`);
        }

        const payload = await response.json();
        const result: ParsedResult = payload.data;

        // Handle empty transcripts or hallucinations (early exit from API)
        if (!result || (!result.entity && !result.value)) {
          setRecordingState('listening');
          return;
        }

        // Reset failure counter on success
        consecutiveFailuresRef.current = 0;

        // Pass result upstream for entity matching and pointer advancement
        setRecordingState('confirming');
        onResult(result);

        // NOTE: Component is responsible for calling confirmEntry() / cancelEntry()
        // After confirmEntry(), the state machine (06_SMART_POINTER.md §10)
        // automatically re-enters 'listening' because continuousMode === true
      } catch (err) {
        consecutiveFailuresRef.current += 1;

        // Auto-stop after too many consecutive failures
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          isContinuousRef.current = false;
          stopVAD();
          setRecordingState('idle');
          onError(new Error('VAD_CONSECUTIVE_FAILURES: Too many consecutive errors. Continuous mode stopped.'));
          return;
        }

        onError(err as Error);
        setRecordingState('listening');
      }
    },
    [
      tableSchema,
      onResult,
      onError,
      setRecordingState,
      stopVAD,
    ]
    // activeCell and navigationMode intentionally omitted —
    // read imperatively via getState() to keep this callback stable.
  );

  /**
   * Start continuous mode
   * Begins VAD loop and starts listening for speech
   */
  const startContinuous = useCallback(async () => {
    isContinuousRef.current = true;
    consecutiveFailuresRef.current = 0;
    setRecordingState('listening');

    await startVAD({
      onSpeechStart: () => {
        if (isContinuousRef.current) {
          setRecordingState('listening');
        }
      },
      onSpeechEnd: handleChunk,
      onError: (err) => {
        onError(err);
        setRecordingState('error');
      },
    });
  }, [startVAD, handleChunk, onError, setRecordingState]);

  /**
   * Stop continuous mode
   * Stops VAD loop and returns to idle state
   */
  const stopContinuous = useCallback(() => {
    isContinuousRef.current = false;
    consecutiveFailuresRef.current = 0;
    stopVAD();
    setRecordingState('idle');
  }, [stopVAD, setRecordingState]);

  return { startContinuous, stopContinuous, volume };
}
