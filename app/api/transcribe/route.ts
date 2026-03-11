/**
 * Transcribe API Route
 * Converts audio files to text using OpenAI Whisper API
 * Based on: docs/05_VOICE_PIPELINE.md §3.1
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'nodejs';

interface TranscribeResponse {
  text: string;
  duration: number;
}

interface ErrorResponse {
  error: string;
}

const RATE_LIMIT = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || userLimit.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

export async function POST(req: NextRequest): Promise<NextResponse<TranscribeResponse | ErrorResponse>> {
  try {
    const userId = req.headers.get('x-user-id') || 'anonymous';
    
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment.' },
        { status: 429 }
      );
    }
    
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio file too large (max 25MB)' },
        { status: 400 }
      );
    }
    
    const language = req.headers.get('x-language') || undefined;
    
    const startTime = Date.now();
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language as 'en' | 'he' | undefined,
      response_format: 'json',
    });
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      text: transcription.text,
      duration,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    
    if (err?.status === 429) {
      return NextResponse.json(
        { error: 'OpenAI rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }
    
    if (err?.status === 400) {
      return NextResponse.json(
        { error: 'Invalid audio format. Please try recording again.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Transcription failed. Please try again.' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-language',
    },
  });
}
