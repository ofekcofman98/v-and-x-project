/**
 * useVAD Hook - Voice Activity Detection
 * Automatically detects speech start/end using Web Audio API AnalyserNode
 * Based on: docs/05_VOICE_PIPELINE.md §9.2
 */

import { useRef, useCallback, useState } from 'react';

export interface VADOptions {
  /** RMS energy level (0–255) above which audio is considered speech. Default: 15 */
  speechThreshold?: number;
  /** RMS energy level below which audio is considered silence. Default: 8 */
  silenceThreshold?: number;
  /** Milliseconds of continuous silence before the chunk is considered complete. Default: 700 */
  silenceDurationMs?: number;
  /** Milliseconds of continuous speech required before recording starts (debounce). Default: 150 */
  speechDebounceMs?: number;
  /** Maximum chunk duration in milliseconds before forcing a flush. Default: 15000 */
  maxChunkMs?: number;
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

export interface VADCallbacks {
  onSpeechStart: () => void;
  onSpeechEnd: (audioBlob: Blob) => void;
  onError: (error: Error) => void;
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
  const [volume, setVolume] = useState(0);

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
   */
  const emitChunk = useCallback((recorder: MediaRecorder, callbacks: VADCallbacks | null) => {
    if (recorder.state !== 'recording') return;

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      chunksRef.current = [];
      callbacks?.onSpeechEnd(blob);
    };

    recorder.stop();
  }, []);

  /**
   * Flush the current recording chunk and trigger onSpeechEnd callback.
   * Keeps capturing a little past the detected silence boundary — the
   * recorder is still running, so this adds real trailing audio rather
   * than silence, protecting short trailing sounds from being clipped.
   */
  const flushChunk = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    const callbacks = callbacksRef.current;

    isSpeakingRef.current = false;
    silenceStartRef.current = null;
    recordingStartRef.current = null;

    setTimeout(() => emitChunk(recorder, callbacks), POST_SPEECH_PADDING_MS);
  }, [emitChunk]);

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

      // Force-flush if chunk is too long
      if (recordingStartRef.current && now - recordingStartRef.current >= maxChunkMs) {
        flushChunk();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (rms < silenceThreshold) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = now;
        } else if (now - silenceStartRef.current >= silenceDurationMs) {
          // Silence confirmed - flush chunk
          flushChunk();
        }
      } else {
        silenceStartRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [speechThreshold, silenceThreshold, speechDebounceMs, silenceDurationMs, maxChunkMs, flushChunk]);

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
      emitChunk(mediaRecorderRef.current, callbacksRef.current);
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
    callbacksRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, [emitChunk]);

  return { startVAD, stopVAD, volume };
}
