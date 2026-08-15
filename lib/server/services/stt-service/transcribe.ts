/**
 * Chat Transcription Service
 * Converts chat-loop voice audio to text using OpenAI Whisper.
 * Extracted from: app/api/transcribe/route.ts
 * Based on: docs/features/17-voice-chat-loop.md
 *
 * Error contract:
 *   Lets OpenAI SDK errors propagate (with `status`/`message`) — the route
 *   layer maps them to HTTP status codes, mirroring lib/server/services/tts-service/speak.ts.
 */

import {
  isWhisperHallucination,
  isDegenerateRepetition,
} from '@/lib/server/services/voice-entry-service/hallucination';
import { openai } from '@/lib/server/services/ai-service/shared/openai-client';
import { AI_MODELS, AI_TUNING } from '@/lib/server/services/ai-service/shared/config';

export interface ChatTranscriptionResult {
  /** Empty string when the raw transcript was filtered as a hallucination — not an error. */
  text: string;
  /** Milliseconds spent in the Whisper call. */
  duration: number;
}

/**
 * Transcribes a single chat-loop audio clip.
 *
 * @param audioFile - The recorded audio clip
 * @param language - Optional Whisper language hint ('en' | 'he')
 * @returns The filtered transcript text and call duration
 * @throws The raw OpenAI SDK error on API failure (status 429/400/etc.)
 */
export async function transcribeChatAudio(
  audioFile: File,
  language?: 'en' | 'he'
): Promise<ChatTranscriptionResult> {
  const startTime = Date.now();
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: AI_MODELS.TRANSCRIPTION,
    language,
    response_format: 'json',
    // Reduces hallucination amplification — no vocabulary prompt is sent
    // for chat transcription, so there's no prompt-echo risk to weigh
    // against (docs/features/17-voice-chat-loop.md §3.1).
    temperature: AI_TUNING.TRANSCRIPTION_TEMPERATURE,
  });
  const duration = Date.now() - startTime;

  // Server-side hallucination guard (docs/features/17-voice-chat-loop.md
  // §3.2) — no `opts` passed: chat sends no vocabulary prompt and this
  // route's `response_format: 'json'` carries no audio duration, so the
  // prompt-echo branch is structurally inapplicable here. A filtered
  // transcript is not an error — the caller treats empty text as
  // "nothing to add" to the chat input.
  const rawText = transcription.text;
  const text = isWhisperHallucination(rawText) || isDegenerateRepetition(rawText) ? '' : rawText;

  return { text, duration };
}
