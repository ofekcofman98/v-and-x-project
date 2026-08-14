/**
 * Text-to-speech request contract for POST /api/speak.
 * docs/features/17-voice-chat-loop.md §7
 *
 * The response body is the raw audio stream itself (Content-Type: audio/mpeg),
 * not JSON — nothing in this stack persists generated audio to a durable URL,
 * so there is no SpeakResponse type; callers read `response.blob()` directly
 * and check the `X-TTS-Cached` header if they care about cache status.
 */

import { z } from 'zod';

export const SpeakRequestSchema = z.object({
  text: z.string().min(1, 'text must not be empty'),
});

export type SpeakRequest = z.infer<typeof SpeakRequestSchema>;
