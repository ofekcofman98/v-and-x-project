# VocalGrid - Voice Processing Pipeline

**Chapter:** 05  
**Dependencies:** 02_ARCHITECTURE.md, 04_STATE_MANAGEMENT.md  
**Related:** 07_MATCHING_ENGINE.md, 11_API_ROUTES.md

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
   - 1.1 [End-to-End Flow](#11-end-to-end-flow)
   - 1.2 [Latency Budget](#12-latency-budget)

2. [Audio Capture (Client-side)](#2-audio-capture-client-side)
   - 2.1 [MediaRecorder Implementation](#21-mediarecorder-implementation)
   - 2.2 [Voice Button Component](#22-voice-button-component)
   - 2.3 [Browser Compatibility](#23-browser-compatibility)

3. [Speech-to-Text (Whisper API)](#3-speech-to-text-whisper-api)
   - 3.1 [API Route Implementation](#31-api-route-implementation)
   - 3.2 [Client-side Transcription Call](#32-client-side-transcription-call)
   - 3.3 [Audio Format Optimization](#33-audio-format-optimization)

4. [Context Parsing (GPT-4o-mini)](#4-context-parsing-gpt-4o-mini)
   - 4.1 [API Route Implementation](#41-api-route-implementation)
   - 4.2 [Response Schema](#42-response-schema)

5. [Value Parsing Utilities](#5-value-parsing-utilities)
   - 5.1 [Type-specific Parsers](#51-type-specific-parsers)

6. [Error Handling](#6-error-handling)
   - 6.1 [Error Scenarios](#61-error-scenarios)
   - 6.2 [Error Recovery Flow](#62-error-recovery-flow)

7. [Performance Optimization](#7-performance-optimization)
   - 7.1 [Parallel Processing](#71-parallel-processing)
   - 7.2 [Streaming (Future Enhancement)](#72-streaming-future-enhancement)

8. [Testing & Monitoring](#8-testing--monitoring)
   - 8.1 [Test Audio Samples](#81-test-audio-samples)
   - 8.2 [Performance Monitoring](#82-performance-monitoring)

9. [Voice Pipeline Checklist](#9-voice-pipeline-checklist)

---


## 1. Pipeline Overview

### 1.1 End-to-End Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    VOICE PIPELINE                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 1. AUDIO CAPTURE (Client)                        │      │
│  │    Browser MediaRecorder API                     │      │
│  │    Duration: User-controlled (press & hold)      │      │
│  └────────────────┬─────────────────────────────────┘      │
│                   │                                         │
│                   ▼                                         │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 2. AUDIO UPLOAD (Client → Server)                │      │
│  │    POST /api/transcribe                          │      │
│  │    Format: FormData with audio blob              │      │
│  │    Latency: ~200-500ms                           │      │
│  └────────────────┬─────────────────────────────────┘      │
│                   │                                         │
│                   ▼                                         │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 3. SPEECH-TO-TEXT (Server → OpenAI)              │      │
│  │    OpenAI Whisper API                            │      │
│  │    Input: Audio blob                             │      │
│  │    Output: "John Smith, 85"                      │      │
│  │    Latency: ~1-2 seconds                         │      │
│  └────────────────┬─────────────────────────────────┘      │
│                   │                                         │
│                   ▼                                         │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 4. CONTEXT PARSING (Server → OpenAI)             │      │
│  │    POST /api/parse                               │      │
│  │    GPT-4o-mini with table context                │      │
│  │    Output: { entity, value, confidence }         │      │
│  │    Latency: ~500ms-1s                            │      │
│  └────────────────┬─────────────────────────────────┘      │
│                   │                                         │
│                   ▼                                         │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 5. SEMANTIC MATCHING (Server)                    │      │
│  │    Fuzzy matching algorithms                     │      │
│  │    Levenshtein, Soundex, LLM fallback            │      │
│  │    Latency: ~10-50ms                             │      │
│  └────────────────┬─────────────────────────────────┘      │
│                   │                                         │
│                   ▼                                         │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 6. VALIDATION (Server)                           │      │
│  │    Check column type, min/max, required          │      │
│  │    Return structured result or error             │      │
│  │    Latency: ~5-10ms                              │      │
│  └────────────────┬─────────────────────────────────┘      │
│                   │                                         │
│                   ▼                                         │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 7. RESPONSE TO CLIENT                            │      │
│  │    JSON: { action, entity, value, confidence }   │      │
│  │    Total Latency: ~2-4 seconds                   │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

TOTAL PIPELINE TIME (P95): < 3.5 seconds
```

### 1.2 Latency Budget
```
Target: < 3.5 seconds (P95) from recording stop to result

Breakdown:
├─ Audio upload:          200-500ms   (15%)
├─ Whisper API:          1000-2000ms  (55%)
├─ GPT-4o-mini:          500-1000ms   (25%)
├─ Matching/validation:  10-50ms      (2%)
└─ Network overhead:     100-300ms    (3%)

Critical path: Whisper API (unavoidable, batch processing)
Optimization opportunity: Parallel processing where possible
```

---

## 2. Audio Capture (Client-side)

### 2.1 MediaRecorder Implementation
```typescript
// lib/hooks/use-voice-recorder.ts

import { useState, useRef, useCallback } from 'react';

interface UseVoiceRecorderOptions {
  onTranscriptReady: (audioBlob: Blob) => void;
  onError: (error: Error) => void;
}

export function useVoiceRecorder({
  onTranscriptReady,
  onError,
}: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ═══════════════════════════════════════════════════════════
  // START RECORDING
  // ═══════════════════════════════════════════════════════════
  const startRecording = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus', // Best compression
      });

      // Reset chunks
      audioChunksRef.current = [];

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle stop
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });
        
        // Clean up stream
        stream.getTracks().forEach((track) => track.stop());
        
        // Stop audio level monitoring
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        // Callback with audio
        onTranscriptReady(audioBlob);
      };

      // Start recording
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Setup audio level monitoring (for visual feedback)
      setupAudioLevelMonitoring(stream);
    } catch (error) {
      onError(error as Error);
    }
  }, [onTranscriptReady, onError]);

  // ═══════════════════════════════════════════════════════════
  // STOP RECORDING
  // ═══════════════════════════════════════════════════════════
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setAudioLevel(0);
    }
  }, [isRecording]);

  // ═══════════════════════════════════════════════════════════
  // AUDIO LEVEL MONITORING (for waveform visualization)
  // ═══════════════════════════════════════════════════════════
  const setupAudioLevelMonitoring = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    microphone.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average level
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalized = average / 255; // 0-1 range
      
      setAudioLevel(normalized);
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  };

  // ═══════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, []);

  return {
    isRecording,
    audioLevel, // 0-1 for visualization
    startRecording,
    stopRecording,
    cleanup,
  };
}
```

### 2.2 Voice Button Component
```typescript
// components/VoiceButton.tsx

'use client';

import { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder';
import { useUIStore } from '@/lib/stores/ui-store';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function VoiceButton() {
  const startRecording = useUIStore((state) => state.startRecording);
  const stopRecording = useUIStore((state) => state.stopRecording);
  const setRecordingState = useUIStore((state) => state.setRecordingState);
  
  const { isRecording, audioLevel, startRecording: start, stopRecording: stop } = useVoiceRecorder({
    onTranscriptReady: async (audioBlob) => {
      setRecordingState('processing');
      
      // Call transcription API
      await handleTranscription(audioBlob);
    },
    onError: (error) => {
      console.error('Recording error:', error);
      setRecordingState('error');
    },
  });
  
  const handleMouseDown = () => {
    startRecording();
    start();
  };
  
  const handleMouseUp = () => {
    stopRecording();
    stop();
  };
  
  return (
    <div className="relative">
      <Button
        size="lg"
        className={`rounded-full p-6 ${
          isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
        }`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={isRecording ? handleMouseUp : undefined}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        {isRecording ? (
          <Square className="h-6 w-6 text-white" />
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}
      </Button>
      
      {/* Audio level indicator */}
      {isRecording && (
        <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-100"
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

async function handleTranscription(audioBlob: Blob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  });
  
  const data = await response.json();
  // Continue to parsing...
}
```

### 2.3 Browser Compatibility
```typescript
// lib/utils/browser-support.ts

export function checkVoiceInputSupport() {
  const support = {
    mediaDevices: !!navigator.mediaDevices?.getUserMedia,
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    audioContext: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
  };
  
  const isSupported = support.mediaDevices && support.mediaRecorder;
  
  return {
    isSupported,
    details: support,
    message: !isSupported
      ? 'Your browser doesn\'t support voice input. Please use Chrome, Firefox, or Safari.'
      : null,
  };
}

// Usage in component:
const support = checkVoiceInputSupport();

if (!support.isSupported) {
  return <div>{support.message}</div>;
}
```

---

## 3. Speech-to-Text (Whisper API)

### 3.1 API Route Implementation
```typescript
// app/api/transcribe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge'; // Use edge runtime for lower latency

// ═══════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════
const RATE_LIMIT = 10; // requests per minute per user
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

// ═══════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    // Get user ID (from auth)
    const userId = req.headers.get('x-user-id') || 'anonymous';
    
    // Check rate limit
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment.' },
        { status: 429 }
      );
    }
    
    // Parse form data
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    // Validate file size (max 25MB for Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio file too large (max 25MB)' },
        { status: 400 }
      );
    }
    
    // Get language from header (optional)
    const language = req.headers.get('x-language') || undefined;
    
    // Call Whisper API
    const startTime = Date.now();
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language, // 'en', 'he', or undefined for auto-detect
      response_format: 'json',
    });
    const duration = Date.now() - startTime;
    
    // Log metrics
    console.log('[STT] Transcription complete', {
      userId,
      duration,
      textLength: transcription.text.length,
    });
    
    return NextResponse.json({
      text: transcription.text,
      duration,
    });
  } catch (error: any) {
    console.error('[STT] Error:', error);
    
    // Handle specific OpenAI errors
    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'OpenAI rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }
    
    if (error?.status === 400) {
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

// ═══════════════════════════════════════════════════════════
// OPTIONS (CORS)
// ═══════════════════════════════════════════════════════════
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-language',
    },
  });
}
```

### 3.2 Client-side Transcription Call
```typescript
// lib/api/transcribe.ts

export async function transcribeAudio(
  audioBlob: Blob,
  options?: {
    language?: 'en' | 'he';
    userId?: string;
  }
): Promise<{ text: string; duration: number }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  
  const headers: HeadersInit = {};
  if (options?.language) {
    headers['x-language'] = options.language;
  }
  if (options?.userId) {
    headers['x-user-id'] = options.userId;
  }
  
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers,
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Transcription failed');
  }
  
  return response.json();
}
```

### 3.3 Audio Format Optimization
```typescript
// lib/utils/audio-utils.ts

/**
 * Convert audio blob to optimal format for Whisper
 * Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
 */
export async function optimizeAudioForWhisper(
  audioBlob: Blob
): Promise<Blob> {
  // WebM with Opus is already optimal for Whisper
  if (audioBlob.type === 'audio/webm;codecs=opus') {
    return audioBlob;
  }
  
  // If browser doesn't support WebM, convert to WAV
  // (This is rare, most modern browsers support WebM)
  const audioContext = new AudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Convert to WAV
  const wavBlob = audioBufferToWav(audioBuffer);
  return wavBlob;
}

function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // Format
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);
  
  // PCM samples
  const offset = 44;
  const channels = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }
  
  let index = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset + index, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      index += 2;
    }
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
```

---

## 4. Context Parsing (GPT-4o-mini)

### 4.1 API Route Implementation
```typescript
// app/api/parse/route.ts

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';

interface ParseRequest {
  transcript: string;
  tableSchema: {
    columns: Array<{ id: string; label: string; type: string; validation?: any }>;
    rows: Array<{ id: string; label: string }>;
  };
  activeCell: {
    rowId: string;
    columnId: string;
  };
  navigationMode: 'column-first' | 'row-first';
}

// ═══════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body: ParseRequest = await req.json();
    
    // Validate request
    if (!body.transcript || !body.tableSchema || !body.activeCell) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Build prompt for GPT
    const prompt = buildParsePrompt(body);
    
    // Call GPT-4o-mini
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a data entry assistant that extracts entities and values from voice transcripts.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for consistency
    });
    const duration = Date.now() - startTime;
    
    // Parse response
    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from GPT');
    }
    
    const parsed = JSON.parse(content);
    
    // Log metrics
    console.log('[Parse] Complete', {
      duration,
      transcript: body.transcript,
      result: parsed,
    });
    
    return NextResponse.json({
      ...parsed,
      duration,
    });
  } catch (error: any) {
    console.error('[Parse] Error:', error);
    
    return NextResponse.json(
      { error: 'Parsing failed. Please try again.' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════
function buildParsePrompt(body: ParseRequest): string {
  const { transcript, tableSchema, activeCell, navigationMode } = body;
  
  const currentColumn = tableSchema.columns.find((c) => c.id === activeCell.columnId);
  const currentRow = tableSchema.rows.find((r) => r.id === activeCell.rowId);
  
  return `
You are parsing voice input for a spreadsheet.

TABLE CONTEXT:
- Available rows (entities): ${tableSchema.rows.map((r) => r.label).join(', ')}
- Available columns: ${tableSchema.columns.map((c) => c.label).join(', ')}

CURRENT STATE:
- Navigation mode: ${navigationMode}
- Active cell: Row="${currentRow?.label}", Column="${currentColumn?.label}"
- Column type: ${currentColumn?.type}
${currentColumn?.validation ? `- Validation: ${JSON.stringify(currentColumn.validation)}` : ''}

USER SAID: "${transcript}"

TASK:
Extract the entity (row) and value (for the active column) from the transcript.

RULES:
1. If navigation mode is "column-first":
   - The user is likely saying: "{entity}, {value}"
   - OR just "{value}" (assume current row)
   
2. If navigation mode is "row-first":
   - The user is likely saying: "{column}, {value}"
   - OR just "{value}" (assume current column)

3. Entity matching:
   - Use fuzzy matching (handle typos, partial names)
   - Match phonetically similar names
   - Be case-insensitive

4. Value extraction:
   - Extract based on column type (${currentColumn?.type})
   - For "number": Parse words like "eighty five" → 85
   - For "boolean": "yes"/"no", "present"/"absent" → true/false
   - For "date": Parse natural language dates
   - For "text": Use as-is

5. Confidence scoring (0-1):
   - 1.0 = Exact match
   - 0.9 = Very close (e.g., "Jon" → "John")
   - 0.8 = Phonetically similar
   - 0.7 = Ambiguous (multiple candidates)
   - < 0.7 = Low confidence

RESPOND ONLY IN JSON:
{
  "entity": "John Smith",
  "entityMatch": {
    "original": "john",
    "matched": "John Smith",
    "confidence": 0.95,
    "matchType": "fuzzy"
  },
  "value": 85,
  "valueValid": true,
  "action": "UPDATE_CELL",
  "reasoning": "Matched 'john' to 'John Smith' with high confidence. Extracted number 85."
}

If the input is unclear or doesn't match any entity:
{
  "entity": null,
  "entityMatch": null,
  "value": null,
  "valueValid": false,
  "action": "ERROR",
  "error": "Could not identify entity. Please try again.",
  "reasoning": "No match found for input."
}
`.trim();
}
```

### 4.2 Response Schema
```typescript
// types/voice-pipeline.ts

export interface ParsedResult {
  entity: string | null;
  entityMatch: {
    original: string;
    matched: string;
    confidence: number;
    matchType: 'exact' | 'fuzzy' | 'phonetic' | 'semantic';
  } | null;
  value: any;
  valueValid: boolean;
  action: 'UPDATE_CELL' | 'ERROR' | 'AMBIGUOUS';
  error?: string;
  alternatives?: Array<{
    entity: string;
    confidence: number;
  }>;
  reasoning?: string;
  duration?: number;
}
```

---

## 5. Value Parsing Utilities

### 5.1 Type-specific Parsers
```typescript
// lib/parsers/value-parsers.ts

import { parse as parseDate } from 'chrono-node';

// ═══════════════════════════════════════════════════════════
// NUMBER PARSER
// ═══════════════════════════════════════════════════════════
export function parseNumber(input: string): number | null {
  // Remove commas
  let cleaned = input.replace(/,/g, '');
  
  // Handle word numbers
  const wordToNumber: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4,
    five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  
  // Convert words to numbers
  const lower = cleaned.toLowerCase();
  
  // Handle "eighty five" → 85
  const words = lower.split(/\s+/);
  let total = 0;
  for (const word of words) {
    if (wordToNumber[word] !== undefined) {
      total = total === 0 ? wordToNumber[word] : total + wordToNumber[word];
    }
  }
  if (total > 0) return total;
  
  // Try parsing as regular number
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ═══════════════════════════════════════════════════════════
// BOOLEAN PARSER
// ═══════════════════════════════════════════════════════════
export function parseBoolean(input: string): boolean | null {
  const lower = input.toLowerCase().trim();
  
  const trueValues = ['yes', 'true', 'present', 'check', 'checked', '1', 'y'];
  const falseValues = ['no', 'false', 'absent', 'uncheck', 'unchecked', '0', 'n'];
  
  if (trueValues.includes(lower)) return true;
  if (falseValues.includes(lower)) return false;
  
  return null;
}

// ═══════════════════════════════════════════════════════════
// DATE PARSER
// ═══════════════════════════════════════════════════════════
export function parseNaturalDate(input: string): Date | null {
  const results = parseDate(input);
  
  if (results.length > 0) {
    return results[0].start.date();
  }
  
  return null;
}

// Examples:
// parseNaturalDate("today") → 2025-02-11
// parseNaturalDate("tomorrow") → 2025-02-12
// parseNaturalDate("march 5") → 2025-03-05
// parseNaturalDate("next monday") → 2025-02-17

// ═══════════════════════════════════════════════════════════
// VALUE VALIDATOR
// ═══════════════════════════════════════════════════════════
export function validateValue(
  value: any,
  columnType: string,
  validation?: any
): { valid: boolean; error?: string } {
  if (value === null || value === undefined) {
    if (validation?.required) {
      return { valid: false, error: 'Value is required' };
    }
    return { valid: true };
  }
  
  switch (columnType) {
    case 'number':
      if (typeof value !== 'number') {
        return { valid: false, error: 'Must be a number' };
      }
      if (validation?.min !== undefined && value < validation.min) {
        return { valid: false, error: `Must be at least ${validation.min}` };
      }
      if (validation?.max !== undefined && value > validation.max) {
        return { valid: false, error: `Must be at most ${validation.max}` };
      }
      break;
      
    case 'text':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Must be text' };
      }
      if (validation?.minLength && value.length < validation.minLength) {
        return { valid: false, error: `Must be at least ${validation.minLength} characters` };
      }
      if (validation?.maxLength && value.length > validation.maxLength) {
        return { valid: false, error: `Must be at most ${validation.maxLength} characters` };
      }
      if (validation?.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          return { valid: false, error: 'Invalid format' };
        }
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Must be yes/no' };
      }
      break;
      
    case 'date':
      if (!(value instanceof Date) && typeof value !== 'string') {
        return { valid: false, error: 'Must be a date' };
      }
      break;
  }
  
  return { valid: true };
}
```

---

## 6. Error Handling

### 6.1 Error Scenarios
```typescript
// types/voice-errors.ts

export class VoiceInputError extends Error {
  constructor(
    public code: string,
    message: string,
    public recoverable: boolean = true,
    public context?: any
  ) {
    super(message);
    this.name = 'VoiceInputError';
  }
}

export const VoiceErrors = {
  // Recording errors
  MIC_PERMISSION_DENIED: new VoiceInputError(
    'MIC_PERMISSION_DENIED',
    'Microphone access denied. Please allow microphone access in your browser settings.',
    false
  ),
  
  MIC_NOT_FOUND: new VoiceInputError(
    'MIC_NOT_FOUND',
    'No microphone detected. Please connect a microphone and try again.',
    false
  ),
  
  RECORDING_FAILED: new VoiceInputError(
    'RECORDING_FAILED',
    'Failed to record audio. Please try again.',
    true
  ),
  
  // STT errors
  STT_TIMEOUT: new VoiceInputError(
    'STT_TIMEOUT',
    'Transcription timed out. Please try a shorter recording.',
    true
  ),
  
  STT_NO_SPEECH: new VoiceInputError(
    'STT_NO_SPEECH',
    'No speech detected. Please speak louder or closer to the microphone.',
    true
  ),
  
  STT_RATE_LIMIT: new VoiceInputError(
    'STT_RATE_LIMIT',
    'Too many requests. Please wait a moment and try again.',
    true
  ),
  
  // Parsing errors
  PARSE_NO_MATCH: new VoiceInputError(
    'PARSE_NO_MATCH',
    'Could not identify the entity. Please try again.',
    true
  ),
  
  PARSE_AMBIGUOUS: new VoiceInputError(
    'PARSE_AMBIGUOUS',
    'Multiple matches found. Please clarify.',
    true
  ),
  
  PARSE_INVALID_VALUE: new VoiceInputError(
    'PARSE_INVALID_VALUE',
    'Invalid value for this column type.',
    true
  ),
};
```

### 6.2 Error Recovery Flow
```typescript
// lib/hooks/use-voice-input.ts

import { useState } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { VoiceInputError } from '@/types/voice-errors';

export function useVoiceInput() {
  const [error, setError] = useState<VoiceInputError | null>(null);
  const setRecordingState = useUIStore((state) => state.setRecordingState);
  
  const handleError = (err: VoiceInputError) => {
    setError(err);
    setRecordingState('error');
    
    // Log to analytics
    console.error('[VoiceInput]', err.code, err.message, err.context);
    
    // Auto-clear error after 5 seconds if recoverable
    if (err.recoverable) {
      setTimeout(() => {
        setError(null);
        setRecordingState('idle');
      }, 5000);
    }
  };
  
  const retry = () => {
    setError(null);
    setRecordingState('idle');
  };
  
  return {
    error,
    handleError,
    retry,
  };
}
```

---

## 7. Performance Optimization

### 7.1 Parallel Processing
```typescript
// app/api/voice-input/route.ts
// Combined transcribe + parse endpoint (experimental)

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioFile = formData.get('audio') as File;
  const tableContext = JSON.parse(formData.get('context') as string);
  
  // Start transcription
  const transcriptionPromise = openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
  });
  
  // While waiting for transcription, prepare parsing context
  const parsingContext = prepareParsingContext(tableContext);
  
  // Wait for transcription
  const transcription = await transcriptionPromise;
  
  // Immediately start parsing (no round trip)
  const parsePromise = openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: buildParsePrompt({
          transcript: transcription.text,
          ...parsingContext,
        }),
      },
    ],
    response_format: { type: 'json_object' },
  });
  
  const parsed = await parsePromise;
  
  // Return combined result (saves one HTTP round trip)
  return NextResponse.json({
    transcript: transcription.text,
    parsed: JSON.parse(parsed.choices[0].message.content!),
  });
}

// Latency improvement: ~200-500ms saved (no client→server→client)
```

### 7.2 Streaming (Future Enhancement)
```typescript
// Note: Whisper doesn't support streaming, but GPT-4o does

// app/api/parse-streaming/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: buildParsePrompt(body) }],
    stream: true, // Enable streaming
  });
  
  // Stream response back to client
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        controller.enqueue(encoder.encode(content));
      }
      controller.close();
    },
  });
  
  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

// Client receives partial results as they stream in
// Perceived latency: ~500ms faster
```

---

## 8. Testing & Monitoring

### 8.1 Test Audio Samples
```typescript
// tests/voice-pipeline.test.ts

describe('Voice Pipeline', () => {
  it('should transcribe clear speech', async () => {
    const audioBlob = await loadTestAudio('clear-speech.webm');
    const result = await transcribeAudio(audioBlob);
    
    expect(result.text).toContain('John Smith');
  });
  
  it('should handle background noise', async () => {
    const audioBlob = await loadTestAudio('noisy-speech.webm');
    const result = await transcribeAudio(audioBlob);
    
    // Should still work, confidence may be lower
    expect(result.text).toBeTruthy();
  });
  
  it('should parse entity and value', async () => {
    const result = await parseTranscript({
      transcript: 'John Smith, 85',
      tableSchema: mockSchema,
      activeCell: { rowId: 'john', columnId: 'quiz_1' },
      navigationMode: 'column-first',
    });
    
    expect(result.entity).toBe('John Smith');
    expect(result.value).toBe(85);
    expect(result.entityMatch.confidence).toBeGreaterThan(0.9);
  });
});
```

### 8.2 Performance Monitoring
```typescript
// lib/monitoring/voice-metrics.ts

export function trackVoiceMetrics(data: {
  phase: 'transcribe' | 'parse' | 'total';
  duration: number;
  success: boolean;
  error?: string;
}) {
  // Send to analytics
  if (typeof window !== 'undefined') {
    (window as any).gtag?.('event', 'voice_input', {
      phase: data.phase,
      duration: data.duration,
      success: data.success,
      error: data.error,
    });
  }
  
  // Check if exceeds budget
  const budgets = {
    transcribe: 2000, // 2 seconds
    parse: 1000, // 1 second
    total: 3500, // 3.5 seconds
  };
  
  if (data.duration > budgets[data.phase]) {
    console.warn(`[Performance] ${data.phase} exceeded budget:`, {
      actual: data.duration,
      budget: budgets[data.phase],
    });
  }
}
```

---

## 9. Voice Pipeline Checklist

**Implementation:**
- [ ] MediaRecorder setup
- [ ] Audio level visualization
- [ ] Whisper API integration
- [ ] GPT-4o-mini parsing
- [ ] Value parsers (number, boolean, date)
- [ ] Error handling
- [ ] Rate limiting

**Testing:**
- [ ] Test with clear speech
- [ ] Test with background noise
- [ ] Test with accents
- [ ] Test with fast/slow speech
- [ ] Test edge cases (empty, too long, etc.)
- [ ] Performance testing (latency < 3.5s)

**Monitoring:**
- [ ] Log transcription latency
- [ ] Log parsing latency
- [ ] Track error rates
- [ ] Monitor API costs

---

*End of Voice Pipeline Documentation*