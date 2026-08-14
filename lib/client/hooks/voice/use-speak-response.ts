'use client';

/**
 * useSpeakResponse — plays an agent chat answer as spoken audio via
 * POST /api/speak. Single-flight: starting new playback stops/discards
 * whatever was already playing. A synthesis/network failure is swallowed —
 * the text response is already rendered and must never be blocked or
 * delayed by this. docs/features/17-voice-chat-loop.md §6
 *
 * `speak()`'s returned promise settles only once playback has actually
 * ended (or immediately, on any failure path) — this is load-bearing for
 * use-chat-voice-loop.ts, which awaits it before re-arming the mic. If it
 * resolved as soon as playback *started*, the mic would re-arm mid-sentence
 * and pick up the agent's own voice.
 *
 * This hook only knows about "text in, audio playback out" — it has no
 * opinion on chat state, mirroring the separation
 * .claude/rules/voice-pipeline.md requires between voice hooks.
 */

import { useCallback, useEffect, useRef } from 'react';

export function useSpeakResponse() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const speak = useCallback(
    async (text: string): Promise<void> => {
      stop();

      try {
        const response = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) return;

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise<void>((resolve) => {
          const finish = () => {
            stop();
            resolve();
          };
          audio.addEventListener('ended', finish, { once: true });
          audio.addEventListener('error', finish, { once: true });

          // Playback rejection (e.g. autoplay policy) is not a chat-breaking
          // error — resolve immediately so the caller isn't stuck waiting.
          audio.play().catch(finish);
        });
      } catch {
        // Network/synthesis failure — fall back silently to text-only, per
        // docs/features/17-voice-chat-loop.md acceptance criteria.
      }
    },
    [stop]
  );

  useEffect(() => stop, [stop]);

  return { speak, stop };
}
