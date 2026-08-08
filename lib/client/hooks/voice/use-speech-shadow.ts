/**
 * useSpeechShadow Hook
 * Thin, table-agnostic wrapper over the browser's SpeechRecognition API.
 * Provides the PROVISIONAL layer's raw text only — it never resolves rows,
 * never touches tableSchema, and never writes anything. Whisper via the
 * existing pipeline remains the sole authoritative source; this hook exists
 * purely to render something on screen ~100ms into speech instead of nothing
 * for 1.3-4s. docs/features/15_realtime_voice_feedback.md §3.2, §2.1-§2.2
 *
 * Feature-detected: `isSupported` is false (and start/stop are no-ops) on
 * browsers without SpeechRecognition (Safari, Firefox) — nothing else in the
 * app depends on this hook succeeding.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal shape of the (non-standard, vendor-prefixed) Web Speech API this
// hook actually uses — the DOM lib does not ship types for it.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechShadowReturn {
  /** Best-effort running transcript for the current utterance, interim or final. */
  interimTranscript: string;
  /** False on browsers without SpeechRecognition — callers must no-op gracefully. */
  isSupported: boolean;
  /** Begin listening. No-op if unsupported or already running. */
  start: () => void;
  /** Stop listening and clear the current transcript. */
  stop: () => void;
}

export function useSpeechShadow(): UseSpeechShadowReturn {
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isActiveRef = useRef(false);

  const CtorRef = useRef<SpeechRecognitionCtor | null>(null);
  if (CtorRef.current === null) {
    CtorRef.current = getSpeechRecognitionCtor();
  }
  const isSupported = CtorRef.current !== null;

  const start = useCallback(() => {
    const Ctor = CtorRef.current;
    if (!Ctor || isActiveRef.current) return;

    isActiveRef.current = true;
    setInterimTranscript('');

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      // Concatenate every result from resultIndex onward — mirrors the
      // conventional Web Speech consumption pattern; interim results are
      // replaced in place by the browser as recognition firms up.
      let combined = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        combined += event.results[i][0].transcript;
      }
      setInterimTranscript(combined.trim());
    };

    recognition.onerror = () => {
      // Provisional layer only — swallow errors silently rather than
      // surfacing a second error channel alongside the real pipeline's.
      // docs/features/15_realtime_voice_feedback.md §3: "must never be able
      // to ... suppress the real pipeline."
    };

    recognition.onend = () => {
      // SpeechRecognition stops itself on any pause even with continuous:true
      // in most implementations — restart transparently while we're still
      // supposed to be listening, so the shadow tracks the whole VAD session.
      if (isActiveRef.current) {
        try {
          recognition.start();
        } catch {
          // Already starting/started — ignore, next onend will retry.
        }
      }
    };

    try {
      recognition.start();
    } catch {
      isActiveRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setInterimTranscript('');
  }, []);

  // Safety net: abort on unmount so a stray recognizer never outlives its component.
  useEffect(() => stop, [stop]);

  return { interimTranscript, isSupported, start, stop };
}
