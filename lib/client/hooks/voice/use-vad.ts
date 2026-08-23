/**
 * useVAD Hook - Voice Activity Detection
 * Automatically detects speech start/end using Web Audio API AnalyserNode
 * Based on: docs/05_VOICE_PIPELINE.md §9.2
 */

import { useRef, useCallback, useState } from 'react';
import { decideChunkFlush } from './vad-chunking';
import { voiceTelemetry } from './use-voice-telemetry';

export interface VADOptions {
  /** RMS energy level (0–255) above which audio is considered speech. Default: 15 */
  speechThreshold?: number;
  /** RMS energy level below which audio is considered silence. Default: 8 */
  silenceThreshold?: number;
  /** Milliseconds of continuous silence before the chunk is considered complete. Default: 700 */
  silenceDurationMs?: number;
  /** Milliseconds of continuous speech required before recording starts (debounce). Default: 150 */
  speechDebounceMs?: number;
  /**
   * Soft cap, in milliseconds, on a single chunk's duration. Past this point
   * the chunk does NOT cut immediately — the effective silence window
   * shrinks to OVERFLOW_SILENCE_MS so it flushes at the next brief
   * inter-word pause instead of mid-word. Default: 15000
   */
  maxChunkMs?: number;
  /**
   * Hard ceiling, in milliseconds, on a single chunk's duration. Backstop
   * for genuinely pause-free speech that never gives maxChunkMs a pause to
   * flush at — force-flushes immediately. Default: 30000
   */
  hardMaxChunkMs?: number;
}

// Short, single-word utterances (e.g. a bare "85") were getting clipped right
// at their start, producing empty Whisper transcripts. The MediaRecorder now
// starts capturing at the first energy crossing (below) instead of only
// after the debounce confirms speech, and the stop is delayed by this many
// ms so trailing consonants aren't cut off at the silence boundary. Kept
// small — the bulk of trailing-silence trimming now comes from the lower
// silenceDurationMs default (ui-store.ts), not from this padding.
// docs/06_SMART_POINTER_LOGS.md
const POST_SPEECH_PADDING_MS = 200;

// Once a chunk has run past maxChunkMs, the effective silence window shrinks
// to this so the chunk flushes at the next brief inter-word pause rather
// than waiting for a full silenceDurationMs pause (or worse, cutting
// mid-word at hardMaxChunkMs). Short enough to catch a natural gap between
// dictated entries, long enough not to fire on a mid-word breath.
const OVERFLOW_SILENCE_MS = 250;

export interface VADCallbacks {
  onSpeechStart: () => void;
  /** requestId identifies this interaction for docs/features/19_voice_telemetry.md. */
  onSpeechEnd: (audioBlob: Blob, requestId: string) => void;
  onError: (error: Error) => void;
  /**
   * Called when a chunk was flushed because it ran past maxChunkMs, rather
   * than because the user paused — i.e. a single utterance was split into
   * multiple chunks. Optional: callers that don't need to surface this
   * (e.g. VAD_CHUNK_TOO_LONG, docs/05_VOICE_PIPELINE.md §9.5) can omit it.
   */
  onChunkOverflow?: () => void;
}

/**
 * Voice Activity Detection hook
 * Uses Web Audio API to detect when user starts and stops speaking
 * Automatically chunks audio based on speech pauses
 */
export function useVAD(options: VADOptions = {}) {
  const {
    speechThreshold = 15,
    silenceThreshold = 8,
    silenceDurationMs = 700,
    speechDebounceMs = 150,
    maxChunkMs = 15_000,
    hardMaxChunkMs = 30_000,
  } = options;

  // Internal refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // VAD state refs
  const isSpeakingRef = useRef(false);
  const silenceStartRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const callbacksRef = useRef<VADCallbacks | null>(null);
  // True from the moment an overflow flush calls recorder.stop() until its
  // onEmitted callback finishes restarting capture. recorder.stop() is
  // synchronous about entering the 'inactive' state but onstop (where the
  // restart happens) fires asynchronously — without this guard, the very
  // next tick would see isSpeaking=false + an inactive recorder and race to
  // start it itself from the "waiting for speech" branch below.
  const restartPendingRef = useRef(false);
  const [volume, setVolume] = useState(0);
  // docs/features/19_voice_telemetry.md §7 — the requestId for the
  // in-progress (or most recently emitted) chunk. A chunk split by overflow
  // gets a fresh requestId at restart (see flushChunk) since each emitted
  // chunk becomes its own /api/voice-entry request.
  const requestIdRef = useRef<string | null>(null);

  /**
   * Calculate RMS (Root Mean Square) energy from audio samples
   * Returns value scaled to 0-255 range
   */
  const getRMS = (analyser: AnalyserNode): number => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const normalised = (data[i] - 128) / 128; // normalize to –1 … +1
      sumSquares += normalised * normalised;
    }
    return Math.sqrt(sumSquares / data.length) * 255; // scale to 0–255
  };

  /**
   * Stops the given (still-running) recorder and emits its buffered chunks
   * via onSpeechEnd. Takes the recorder/callbacks as arguments (rather than
   * reading the refs) so a caller can capture them before scheduling a
   * delayed call — protecting against stopVAD nulling the refs out from
   * under a pending setTimeout (see flushChunk below).
   * `onEmitted` runs after onSpeechEnd, at the point the recorder is
   * reliably 'inactive' — the only safe place to restart capture for an
   * overflow flush, since restarting from the tick loop's `!isSpeaking`
   * branch requires the recorder to already be inactive (see tick()).
   */
  const emitChunk = useCallback(
    (recorder: MediaRecorder, callbacks: VADCallbacks | null, requestId: string, onEmitted?: () => void) => {
      if (recorder.state !== 'recording') return;

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        // docs/features/19_voice_telemetry.md §7 — recording_stop_at, chunk-emit.
        voiceTelemetry.mark(requestId, 'recordingStopAt');
        callbacks?.onSpeechEnd(blob, requestId);
        onEmitted?.();
      };

      recorder.stop();
    },
    []
  );

  /**
   * Flush the current recording chunk and trigger onSpeechEnd callback.
   *
   * `reason: 'silence'` (default) — a real pause was detected. Keeps
   * capturing a little past the detected silence boundary — the recorder is
   * still running, so this adds real trailing audio rather than silence,
   * protecting short trailing sounds from being clipped.
   *
   * `reason: 'overflow'` — the chunk ran past maxChunkMs and is being split
   * mid-utterance (the user is still speaking). There is no trailing
   * consonant to protect and the padding window is what previously opened a
   * race that wedged the recorder (docs/06_SMART_POINTER_LOGS.md) — so this
   * emits immediately and restarts capture right after, keeping the loop
   * running instead of leaving `isSpeaking` true with an inactive recorder.
   */
  const flushChunk = useCallback(
    (reason: 'silence' | 'overflow' = 'silence') => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') return;

      const callbacks = callbacksRef.current;
      // Capture now — an overflow restart regenerates requestIdRef.current
      // for the NEXT chunk before this emit's async onstop fires.
      const requestId = requestIdRef.current ?? voiceTelemetry.begin();

      isSpeakingRef.current = false;
      silenceStartRef.current = null;
      recordingStartRef.current = null;

      if (reason === 'overflow') {
        restartPendingRef.current = true;
        callbacks?.onChunkOverflow?.();
        emitChunk(recorder, callbacks, requestId, () => {
          // Recorder is reliably 'inactive' here (see emitChunk). Restart
          // immediately — the user is still speaking through the split, so
          // treat this exactly like an already-confirmed, already-running
          // speech segment rather than re-arming the debounce from scratch.
          if (mediaRecorderRef.current?.state === 'inactive') {
            chunksRef.current = [];
            mediaRecorderRef.current.start(100);
          }
          isSpeakingRef.current = true;
          recordingStartRef.current = Date.now();
          restartPendingRef.current = false;
          // The continuation chunk is its own /api/voice-entry request —
          // fresh requestId, fresh vad_start_at at the restart moment.
          requestIdRef.current = voiceTelemetry.begin();
        });
        return;
      }

      setTimeout(() => emitChunk(recorder, callbacks, requestId), POST_SPEECH_PADDING_MS);
    },
    [emitChunk]
  );

  /**
   * Main VAD loop - runs on every animation frame
   * Monitors audio levels and triggers recording start/stop
   */
  const tick = useCallback(() => {
    if (!analyserRef.current || !callbacksRef.current) return;

    const rms = getRMS(analyserRef.current);
    const now = Date.now();
    const normalizedVolume = Math.min(1, Math.max(0, rms / 255));
    setVolume(normalizedVolume);

    // An overflow restart is in flight (recorder.stop() called, onstop not
    // yet fired) — skip processing this frame rather than racing it from
    // the "waiting for speech" branch below. See restartPendingRef.
    if (restartPendingRef.current) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    if (!isSpeakingRef.current) {
      // Waiting for speech to start
      if (rms >= speechThreshold) {
        if (!speechStartRef.current) {
          speechStartRef.current = now;

          // Start capturing immediately at the first energy crossing, rather
          // than only after the debounce period confirms real speech — this
          // preserves the debounce window itself as pre-roll instead of
          // clipping it. False triggers (debounce never confirms) are
          // discarded below without ever reaching onSpeechEnd.
          if (mediaRecorderRef.current?.state === 'inactive') {
            chunksRef.current = [];
            mediaRecorderRef.current.start(100);
          }
        } else if (now - speechStartRef.current >= speechDebounceMs) {
          // Speech confirmed after debounce period - recording is already running
          isSpeakingRef.current = true;
          speechStartRef.current = null;
          silenceStartRef.current = null;
          recordingStartRef.current = now;

          // docs/features/19_voice_telemetry.md §7 — requestId generation, vad_start_at.
          requestIdRef.current = voiceTelemetry.begin();
          callbacksRef.current.onSpeechStart();
        }
      } else {
        // RMS dropped back below threshold before the debounce confirmed —
        // discard the speculative recording so it never leaks into the next
        // real utterance's blob.
        if (speechStartRef.current && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
          chunksRef.current = [];
        }
        speechStartRef.current = null;
      }
    } else {
      // Currently recording

      // Defense in depth: isSpeakingRef can in principle be left `true`
      // while the recorder itself is inactive — that exact combination
      // previously wedged the loop permanently, since a restart only ever
      // lived in the `!isSpeaking` branch above (unreachable once stuck
      // here). Detect and self-heal it so the stuck state is structurally
      // unreachable rather than merely avoided by getting every flush path
      // right. docs/06_SMART_POINTER_LOGS.md
      if (mediaRecorderRef.current?.state !== 'recording') {
        isSpeakingRef.current = false;
        silenceStartRef.current = null;
        recordingStartRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (rms < silenceThreshold) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = now;
        }
      } else {
        silenceStartRef.current = null;
      }

      const chunkElapsedMs = recordingStartRef.current ? now - recordingStartRef.current : 0;
      const silenceElapsedMs = silenceStartRef.current ? now - silenceStartRef.current : null;

      const flushReason = decideChunkFlush(
        { chunkElapsedMs, silenceElapsedMs },
        { maxChunkMs, hardMaxChunkMs, silenceDurationMs, overflowSilenceMs: OVERFLOW_SILENCE_MS }
      );

      if (flushReason) {
        flushChunk(flushReason);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [
    speechThreshold,
    silenceThreshold,
    speechDebounceMs,
    silenceDurationMs,
    maxChunkMs,
    hardMaxChunkMs,
    flushChunk,
  ]);

  /**
   * Start VAD listening loop
   * Requests microphone access and begins monitoring for speech
   */
  const startVAD = useCallback(async (callbacks: VADCallbacks) => {
    callbacksRef.current = callbacks;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Create MediaRecorder in inactive state - VAD loop will call .start()
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;

      // Start the VAD tick loop
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      callbacks.onError(err as Error);
    }
  }, [tick]);

  /**
   * Stop VAD listening loop
   * Cleans up all resources and stops microphone access
   */
  const stopVAD = useCallback(() => {
    // Cancel animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Flush any in-progress recording immediately (no trailing pad) — the
    // stream is torn down right below, so there's no more audio to wait for.
    if (isSpeakingRef.current && mediaRecorderRef.current) {
      emitChunk(mediaRecorderRef.current, callbacksRef.current, requestIdRef.current ?? voiceTelemetry.begin());
    }

    // Stop microphone stream
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Close AudioContext
    audioContextRef.current?.close();

    // Reset all refs
    isSpeakingRef.current = false;
    speechStartRef.current = null;
    silenceStartRef.current = null;
    recordingStartRef.current = null;
    restartPendingRef.current = false;
    callbacksRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    requestIdRef.current = null;
  }, [emitChunk]);

  return { startVAD, stopVAD, volume };
}
