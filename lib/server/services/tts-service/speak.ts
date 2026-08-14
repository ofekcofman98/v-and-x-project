/**
 * TTS Service — turns agent chat text into spoken audio.
 * docs/features/17-voice-chat-loop.md §6
 */

import OpenAI from 'openai';
import { truncateAtSentence } from '@/lib/shared/utils/truncate-at-sentence';
import { stripMarkdown } from '@/lib/shared/utils/strip-markdown';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TTS_MODEL = 'tts-1';
const TTS_VOICE = 'alloy';

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
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input,
  });

  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, contentType: 'audio/mpeg' };
}
