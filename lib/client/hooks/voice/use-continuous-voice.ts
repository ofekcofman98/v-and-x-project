/**
 * useContinuousVoice Hook
 * Wraps VAD and plugs it into the voice pipeline for continuous flow mode
 * Based on: docs/05_VOICE_PIPELINE.md §9.3
 */

import { useCallback, useRef } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useVAD } from '@/lib/client/hooks/voice/use-vad';
import { toast } from '@/components/ui/use-toast';
import { ErrorCodes } from '@/lib/shared/types/voice-errors';
import { getErrorMessage } from '@/lib/shared/errors/error-mapping';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { ParsedResult, VoiceEntryResult, VoiceBatchResult } from '@/lib/shared/types/voice-pipeline';
import { isVoiceBatchResult } from '@/lib/shared/types/voice-pipeline';

interface UseContinuousVoiceOptions {
  tableId: string;
  tableSchema: TableSchema;
  onResult: (result: ParsedResult) => void;
  onBatchResult: (result: VoiceBatchResult) => void;
  onError: (error: Error) => void;
}

/**
 * Continuous voice input hook
 * Automatically detects speech, processes it through the voice pipeline,
 * and returns to listening after each entry
 */
export function useContinuousVoice({
  tableId,
  tableSchema,
  onResult,
  onBatchResult,
  onError,
}: UseContinuousVoiceOptions) {
  // VAD sensitivity must remain a reactive subscription — changes to these preferences
  // must propagate to useVAD so the audio pipeline reinitialises with the new thresholds.
  const vadSensitivity = useUIStore((s) => s.preferences.vadSensitivity);
  const setRecordingState = useUIStore((s) => s.setRecordingState);
  const setLastTranscript = useUIStore((s) => s.setLastTranscript);

  // activeCell and navigationMode are read imperatively inside handleChunk via
  // useUIStore.getState() — avoids re-creating the callback on every cell-selection change.

  // Initialize VAD with user preferences
  const { startVAD, stopVAD, volume } = useVAD({
    speechThreshold: vadSensitivity.speechThreshold,
    silenceThreshold: vadSensitivity.silenceThreshold,
    silenceDurationMs: vadSensitivity.silenceDurationMs,
    speechDebounceMs: 150,
    maxChunkMs: vadSensitivity.maxChunkMs,
    hardMaxChunkMs: vadSensitivity.hardMaxChunkMs,
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
        formData.append('tableId', tableId);

        const response = await fetch('/api/voice-entry', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Voice entry failed: ${response.statusText}`);
        }

        const payload = await response.json();
        const result: VoiceEntryResult | VoiceBatchResult = payload.data;

        // Echo what Whisper actually heard, including on the empty/hallucination
        // early-exit below — that's exactly when the user most needs to see it.
        // docs/features/15_realtime_voice_feedback.md §3.4
        if (result) {
          setLastTranscript(result.transcript);
        }

        // Batch results are routed separately — see docs/features/03_ai_table_agent.md §5.
        if (result && isVoiceBatchResult(result)) {
          consecutiveFailuresRef.current = 0;
          setRecordingState('confirming');
          onBatchResult(result);
          return;
        }

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
      tableId,
      tableSchema,
      onResult,
      onBatchResult,
      onError,
      setRecordingState,
      setLastTranscript,
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
    setLastTranscript(null);
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
      // Informational only — a long utterance was split into multiple
      // chunks (docs/05_VOICE_PIPELINE.md §9.5, VAD_CHUNK_TOO_LONG). Deliberately
      // NOT routed through useVoiceErrorHandler's dispatchError: that sets
      // recordingState: 'error' and force-resets to 'idle' after 2s, which
      // would tear down continuous mode over something that isn't a failure —
      // the loop must keep listening straight through the split.
      onChunkOverflow: () => {
        const { title, message } = getErrorMessage(ErrorCodes.VAD_CHUNK_TOO_LONG);
        toast({ title, description: message, duration: 3000 });
      },
    });
  }, [startVAD, handleChunk, onError, setRecordingState, setLastTranscript]);

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
