'use client';

/**
 * useChatVoiceLoop — hands-free voice conversation for a chat panel: press
 * once, speak, get auto-transcribed and auto-submitted on silence, hear the
 * agent's answer, and have the mic re-arm for the next turn. Ends only on
 * an explicit stop() (or a VAD error).
 * docs/features/17-voice-chat-loop.md §5–§6
 *
 * Half-duplex by design (matches spec §8 — barge-in is out of scope): the
 * mic is fully torn down (stopVAD) the instant a question is ready to
 * submit, and only re-armed (fresh startVAD) once the answer has finished
 * playing. This also means the mic can never pick up the agent's own TTS
 * audio — there is no window where both are active at once.
 *
 * This hook owns audio capture + turn sequencing only. It does not know
 * about chat messages, agent mutations, or tables — the panel supplies
 * `onSubmit` (fire-and-forget: "here's the question") and later calls
 * `endTurn` (with the answer to speak, or nothing on error) once its own
 * mutation settles. Mirrors the separation `.claude/rules/voice-pipeline.md`
 * requires between voice hooks and, structurally, the existing
 * `use-continuous-voice.ts` (same useVAD-wrapping shape, same
 * isActiveRef/onChunkOverflow pattern) — reused here as the model rather
 * than duplicated logic, since that hook's own body is grid-pointer-specific
 * and cannot be reused directly (`.claude/rules/architecture.md` DRY note).
 */

import { useCallback, useRef, useState } from 'react';
import { useVAD, type VADCallbacks } from './use-vad';
import { useUIStore } from '@/lib/client/stores/ui-store';

export type ChatVoicePhase = 'idle' | 'listening' | 'transcribing' | 'answering' | 'speaking';

interface UseChatVoiceLoopOptions {
  /** Called once a complete question is ready to send. Fire-and-forget — the panel drives its own mutation. */
  onSubmit: (text: string) => void;
  onError?: (error: Error) => void;
}

// Chat questions have longer natural mid-sentence pauses than a single
// dictated cell value (the 700ms default in ui-store's vadSensitivity) —
// 1100ms avoids cutting a spoken question off early.
const CHAT_SILENCE_DURATION_MS = 1100;

export function useChatVoiceLoop({ onSubmit, onError }: UseChatVoiceLoopOptions) {
  const vadSensitivity = useUIStore((s) => s.preferences.vadSensitivity);

  const [phase, setPhase] = useState<ChatVoicePhase>('idle');
  const isActiveRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');
  // Set by onChunkOverflow — the next onSpeechEnd is a mid-utterance split,
  // not the end of the question, so it must accumulate and keep listening
  // rather than submit. Without this a long question sends as two halves.
  const isOverflowContinuationRef = useRef(false);

  const { startVAD, stopVAD, volume } = useVAD({
    speechThreshold: vadSensitivity.speechThreshold,
    silenceThreshold: vadSensitivity.silenceThreshold,
    silenceDurationMs: CHAT_SILENCE_DURATION_MS,
    speechDebounceMs: 150,
    maxChunkMs: vadSensitivity.maxChunkMs,
    hardMaxChunkMs: vadSensitivity.hardMaxChunkMs,
  });

  const handleChunk = useCallback(
    async (audioBlob: Blob) => {
      if (!isActiveRef.current) return;

      const isOverflowContinuation = isOverflowContinuationRef.current;
      isOverflowContinuationRef.current = false;

      setPhase('transcribing');

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'chat-question.webm');

        const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Transcription failed');

        const { text } = (await response.json()) as { text: string };
        const trimmed = text?.trim();

        if (trimmed) {
          accumulatedTranscriptRef.current = accumulatedTranscriptRef.current
            ? `${accumulatedTranscriptRef.current} ${trimmed}`
            : trimmed;
        }

        if (isOverflowContinuation) {
          // Still mid-question — useVAD already restarted capture on its
          // own; just resume listening for the rest of the utterance.
          if (isActiveRef.current) setPhase('listening');
          return;
        }

        const finalTranscript = accumulatedTranscriptRef.current;
        accumulatedTranscriptRef.current = '';

        if (!finalTranscript) {
          // Filtered silence/hallucination with nothing accumulated —
          // resume listening for the next attempt instead of submitting.
          if (isActiveRef.current) setPhase('listening');
          return;
        }

        // Tear the mic down before handing off — the panel's mutation and
        // the spoken answer both happen with the mic fully closed, so it
        // can never pick up the agent's own TTS audio (see module doc).
        stopVAD();
        setPhase('answering');
        onSubmit(finalTranscript);
        // The panel now owns this turn; it must call endTurn() (success or
        // error) to re-arm listening, including on any early-bail path.
      } catch (err) {
        onError?.(err as Error);
        if (isActiveRef.current) setPhase('listening');
      }
    },
    [onSubmit, onError, stopVAD]
  );

  const vadCallbacks = useCallback(
    (): VADCallbacks => ({
      onSpeechStart: () => {
        if (isActiveRef.current) setPhase('listening');
      },
      onSpeechEnd: handleChunk,
      onError: (err) => {
        onError?.(err);
        isActiveRef.current = false;
        setPhase('idle');
      },
      onChunkOverflow: () => {
        isOverflowContinuationRef.current = true;
      },
    }),
    [handleChunk, onError]
  );

  const start = useCallback(async () => {
    isActiveRef.current = true;
    accumulatedTranscriptRef.current = '';
    isOverflowContinuationRef.current = false;
    setPhase('listening');
    await startVAD(vadCallbacks());
  }, [startVAD, vadCallbacks]);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    accumulatedTranscriptRef.current = '';
    isOverflowContinuationRef.current = false;
    stopVAD();
    setPhase('idle');
  }, [stopVAD]);

  /**
   * The panel calls this once its turn is fully resolved. `speakPromise` is
   * whatever the panel's own `useSpeakResponse().speak(...)` call already
   * returned (or omitted on error/early-bail/mute) — this hook does not own
   * audio playback itself (TTS must play regardless of whether the voice
   * loop is active at all, e.g. for a typed question), it only waits for
   * playback to finish before re-arming the mic, so the mic can never pick
   * up the agent's own voice. Re-arms only if the loop is still active,
   * since the user may have pressed stop mid-answer. No-ops entirely if the
   * loop was never started (e.g. the turn came from typed input).
   */
  const endTurn = useCallback(
    async (speakPromise?: Promise<void>) => {
      if (!isActiveRef.current) return;

      setPhase('speaking');
      if (speakPromise) {
        await speakPromise;
      }

      if (!isActiveRef.current) return;

      setPhase('listening');
      await startVAD(vadCallbacks());
    },
    [startVAD, vadCallbacks]
  );

  return {
    isActive: phase !== 'idle',
    phase,
    volume,
    start,
    stop,
    endTurn,
  };
}
