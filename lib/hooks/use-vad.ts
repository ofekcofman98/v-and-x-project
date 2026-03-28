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
  /** Milliseconds of continuous silence before the chunk is considered complete. Default: 1800 */
  silenceDurationMs?: number;
  /** Milliseconds of continuous speech required before recording starts (debounce). Default: 150 */
  speechDebounceMs?: number;
  /** Maximum chunk duration in milliseconds before forcing a flush. Default: 15000 */
  maxChunkMs?: number;
}

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
    silenceDurationMs = 1800,
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
   * Flush the current recording chunk and trigger onSpeechEnd callback
   */
  const flushChunk = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      chunksRef.current = [];
      callbacksRef.current?.onSpeechEnd(blob);
    };

    mediaRecorderRef.current.stop();
    isSpeakingRef.current = false;
    silenceStartRef.current = null;
    recordingStartRef.current = null;
  }, []);

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
        } else if (now - speechStartRef.current >= speechDebounceMs) {
          // Speech confirmed after debounce period - start recording
          isSpeakingRef.current = true;
          speechStartRef.current = null;
          silenceStartRef.current = null;
          recordingStartRef.current = now;

          chunksRef.current = [];
          mediaRecorderRef.current?.start(100);
          callbacksRef.current.onSpeechStart();
        }
      } else {
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

    // Flush any in-progress recording
    if (isSpeakingRef.current) flushChunk();

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
  }, [flushChunk]);

  return { startVAD, stopVAD, volume };
}
