/**
 * TTS Service — turns agent chat text into spoken audio.
 * docs/features/17-voice-chat-loop.md §6
 */

import { truncateAtSentence } from '@/lib/shared/utils/truncate-at-sentence';
import { stripMarkdown } from '@/lib/shared/utils/strip-markdown';
import { openai } from '@/lib/server/services/ai-service/shared/openai-client';
import { AI_MODELS } from '@/lib/server/services/ai-service/shared/config';

export interface SpeakResult {
  audio: Buffer;
  /** MIME type of `audio` — always mp3 for `tts-1`. */
  contentType: string;
}

/**
 * Synthesizes speech for `text` via OpenAI TTS. Strips Markdown to plain
 * speakable text first (agent answers bold entity names / use lists — see
 * stripMarkdown), then truncates to MAX_SPEAK_CHARS at a sentence boundary
 * (docs §7), so the character budget counts speakable text, not markup.
 * Callers pass the raw agent response as-is.
 */
export async function synthesizeSpeech(text: string): Promise<SpeakResult> {
  const input = truncateAtSentence(stripMarkdown(text));

  const response = await openai.audio.speech.create({
    model: AI_MODELS.TTS,
    voice: AI_MODELS.TTS_VOICE,
    input,
  });

  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, contentType: 'audio/mpeg' };
}
