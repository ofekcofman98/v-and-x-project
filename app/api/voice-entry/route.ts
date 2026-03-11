/**
 * Unified Voice Entry API Route
 * Combines transcription and parsing into a single endpoint
 * Eliminates one network round-trip for faster response times
 * Based on: docs/05_VOICE_PIPELINE.md
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { ColumnType } from '@/lib/types/column-types';
import type { ColumnDefinition, TableSchema } from '@/lib/types/table-schema';
import type { ParsedResult } from '@/lib/types/voice-pipeline';
import {
  parseBoolean,
  parseNaturalDate,
  parseNumber,
  validateValue,
} from '@/lib/parsers/value-parsers';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const runtime = 'edge';

const ColumnSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.nativeEnum(ColumnType),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
      required: z.boolean().optional(),
    })
    .optional(),
});

const TableSchemaInput = z.object({
  columns: z.array(ColumnSchema),
  rows: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    })
  ),
});

const ParsedResultSchema = z.object({
  entity: z.string().nullable(),
  entityMatch: z
    .object({
      original: z.string().nullable(),
      matched: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      matchType: z.enum(['exact', 'fuzzy', 'phonetic', 'semantic']).nullable(),
    })
    .nullable(),
  value: z.any(),
  valueValid: z.boolean(),
  action: z.enum(['UPDATE_CELL', 'ERROR', 'AMBIGUOUS']),
  error: z.string().optional(),
  alternatives: z
    .array(
      z.object({
        entity: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .optional(),
  reasoning: z.string().optional(),
  duration: z.number().optional(),
});

interface VoiceEntryResponse {
  success: boolean;
  data?: ParsedResult & {
    transcript: string;
    transcriptionDuration: number;
    parsingDuration: number;
    totalDuration: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
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

export async function POST(req: NextRequest): Promise<NextResponse<VoiceEntryResponse>> {
  const totalStartTime = Date.now();

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OPENAI_KEY_MISSING',
            message: 'OpenAI API key is not configured.',
          },
        },
        { status: 500 }
      );
    }

    const userId = req.headers.get('x-user-id') || 'anonymous';

    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please wait a moment.',
          },
        },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const tableSchemaJson = formData.get('tableSchema') as string | null;
    const activeCellJson = formData.get('activeCell') as string | null;
    const navigationMode = (formData.get('navigationMode') as string) || 'column-first';

    if (!audioFile) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_AUDIO_FILE',
            message: 'No audio file provided',
          },
        },
        { status: 400 }
      );
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Audio file too large (max 25MB)',
          },
        },
        { status: 400 }
      );
    }

    if (!tableSchemaJson || !activeCellJson) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'Missing required parameters (tableSchema or activeCell)',
          },
        },
        { status: 400 }
      );
    }

    let tableSchema: TableSchema;
    let activeCell: { rowId: string; columnId: string };

    try {
      tableSchema = TableSchemaInput.parse(JSON.parse(tableSchemaJson));
      activeCell = JSON.parse(activeCellJson);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'Invalid tableSchema or activeCell format',
            details: error,
          },
        },
        { status: 400 }
      );
    }

    // Step 1: Transcribe audio using Whisper
    console.log('[VoiceEntry] Starting transcription...');
    const transcriptionStartTime = Date.now();

    const language = req.headers.get('x-language') || undefined;

    let transcript: string;
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: language as 'en' | 'he' | undefined,
        response_format: 'json',
      });
      transcript = transcription.text;
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };

      if (err?.status === 429) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'STT_RATE_LIMIT',
              message: 'OpenAI rate limit exceeded. Please try again in a moment.',
            },
          },
          { status: 429 }
        );
      }

      if (err?.status === 400) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_AUDIO',
              message: 'Invalid audio format. Please try recording again.',
            },
          },
          { status: 400 }
        );
      }

      throw error;
    }

    const transcriptionDuration = Date.now() - transcriptionStartTime;
    console.log('[VoiceEntry] Transcription complete:', { transcript, duration: transcriptionDuration });

    // Step 2: Parse transcript using GPT-4o-mini
    console.log('[VoiceEntry] Starting parsing...');
    const parsingStartTime = Date.now();

    const activeColumn = tableSchema.columns.find((col) => col.id === activeCell.columnId);
    const activeRow = tableSchema.rows.find((row) => row.id === activeCell.rowId);

    if (!activeColumn || !activeRow) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CELL_NOT_FOUND',
            message: 'Active cell cannot be resolved.',
          },
        },
        { status: 400 }
      );
    }

    const prompt = buildParsePrompt({
      transcript,
      tableSchema,
      activeCell,
      navigationMode: navigationMode as 'column-first' | 'row-first',
    });

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
      temperature: 0.1,
      max_tokens: 256,
    });

    const parsingDuration = Date.now() - parsingStartTime;
    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('LLM returned empty content');
    }

    const parsedResult = parseCompletion(rawContent);
    const normalizedValue = normalizeValue(parsedResult.value, activeColumn);
    const validation = validateValue(normalizedValue, activeColumn.type, activeColumn.validation);

    const totalDuration = Date.now() - totalStartTime;

    const responsePayload: ParsedResult = {
      ...parsedResult,
      value: validation.valid ? normalizedValue : null,
      valueValid: validation.valid,
      duration: totalDuration,
      error: validation.valid ? parsedResult.error : validation.error ?? parsedResult.error,
    };

    console.log('[VoiceEntry] Complete:', {
      transcript,
      transcriptionDuration,
      parsingDuration,
      totalDuration,
      result: responsePayload,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...responsePayload,
        transcript,
        transcriptionDuration,
        parsingDuration,
        totalDuration,
      },
    });
  } catch (error) {
    const totalDuration = Date.now() - totalStartTime;
    console.error('[VoiceEntry] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VOICE_ENTRY_FAILED',
          message: 'Failed to process voice entry. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}

function parseCompletion(content: string): ParsedResult {
  const parsed = JSON.parse(content);
  const validated = ParsedResultSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error('LLM output did not match expected schema');
  }

  return validated.data;
}

function normalizeValue(value: unknown, column: ColumnDefinition) {
  if (value === null || value === undefined) {
    return null;
  }

  switch (column.type) {
    case ColumnType.NUMBER:
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseNumber(value);
      return null;

    case ColumnType.BOOLEAN:
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return parseBoolean(value);
      return null;

    case ColumnType.DATE:
      if (typeof value === 'string') {
        const date = parseNaturalDate(value);
        return date ? date.toISOString() : null;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return null;

    case ColumnType.TEXT:
    default:
      if (typeof value === 'string') {
        return value.trim();
      }
      return value;
  }
}

function buildParsePrompt(params: {
  transcript: string;
  tableSchema: TableSchema;
  activeCell: { rowId: string; columnId: string };
  navigationMode: 'column-first' | 'row-first';
}) {
  const { transcript, tableSchema, activeCell, navigationMode } = params;
  const currentColumn = tableSchema.columns.find((col) => col.id === activeCell.columnId);
  const columnType = currentColumn?.type ?? 'text';

  // Context Diet: We deliberately DO NOT pass the rows/entities array here!
  // We only tell it what column it's currently on to help parse the value.

  return `
You are a lightning-fast data extraction assistant.
Your ONLY job is to extract the spoken entity and the value from the transcript.
Do NOT attempt to match the entity against any database. Return EXACTLY what was heard.

CURRENT STATE:
- Navigation mode: ${navigationMode}
- Expected Column Type: ${columnType} (e.g. if 'number', convert word numbers like "eighty" to 80)

USER SAID: "${transcript}"

RESPOND ONLY IN JSON (strictly matching this schema):
{
  "entity": "The exact entity name you heard",
  "entityMatch": {
    "original": "The exact entity name you heard",
    "matched": "The exact entity name you heard",
    "confidence": 1.0,
    "matchType": "exact"
  },
  "value": "The extracted value",
  "valueValid": true,
  "action": "UPDATE_CELL",
  "reasoning": "Extracted raw data from transcript"
}
`.trim();
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
