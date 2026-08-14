/**
 * Speak API Route
 * Converts agent chat text to spoken audio via OpenAI TTS.
 * HTTP transport layer only — synthesis lives in
 * lib/server/services/tts-service/speak.ts.
 * docs/features/17-voice-chat-loop.md §6
 */

import { NextRequest, NextResponse } from 'next/server';
import { SpeakRequestSchema } from '@/lib/shared/types/tts';
import { synthesizeSpeech } from '@/lib/server/services/tts-service/speak';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key is not configured.' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = SpeakRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
  }

  try {
    const { audio, contentType } = await synthesizeSpeech(parsed.data.text);

    // No caching in this POC (docs/features/17-voice-chat-loop.md §7) — the
    // header is reserved so a future cache layer doesn't require a
    // response-shape change.
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-TTS-Cached': 'false',
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number };

    if (err?.status === 429) {
      return NextResponse.json({ error: 'TTS rate limit exceeded. Please try again in a moment.' }, { status: 429 });
    }

    console.error('[Speak] Synthesis failed:', error);
    return NextResponse.json({ error: 'Speech synthesis failed.' }, { status: 500 });
  }
}
