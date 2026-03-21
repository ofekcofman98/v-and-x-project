/**
 * Unified Voice Entry API Route
 * Combines transcription and parsing into a single endpoint
 * Eliminates one network round-trip for faster response times
 * Based on: docs/05_VOICE_PIPELINE.md
 * 
 * Performance Optimizations (docs/10_PERFORMANCE.md):
 * - Transcript caching (Section 6.4): Avoid re-transcribing identical audio
 * - Entity recognition cache (Section 4.5): Skip LLM for known entities
 * - Quick entity extraction: Regex-based pattern matching before LLM
 * - Performance monitoring (Section 8.3): Track cache hits and LLM fallbacks
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
import { match } from '@/lib/matching/matcher';
import { transcriptCache } from '@/lib/cache/transcript-cache';
import { entityCache } from '@/lib/cache/entity-recognition-cache';

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
    cached?: boolean;
    matchType?: 'exact' | 'phonetic' | 'fuzzy' | 'semantic';
    pathTaken?: 'TRANSCRIPT_CACHE_HIT' | 'ENTITY_CACHE_HIT' | 'FAST_PATH' | 'LLM_FALLBACK';
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

    // Step 1: Transcribe audio using Whisper (with caching)
    console.log('[VoiceEntry] Starting transcription...');
    const transcriptionStartTime = Date.now();

    const language = req.headers.get('x-language') || undefined;
    const tableId = formData.get('tableId') as string || 'default';

    let transcript: string;
    let transcriptionDuration: number;
    let transcriptFromCache = false;

    // ═══════════════════════════════════════════════════════════
    // OPTIMIZATION 1: Check transcript cache
    // ═══════════════════════════════════════════════════════════
    const cachedTranscript = await transcriptCache.get(audioFile);
    
    if (cachedTranscript) {
      console.log('[VoiceEntry] 🚀 TRANSCRIPT_CACHE_HIT: Saved 1300ms transcription');
      transcript = cachedTranscript.text;
      transcriptionDuration = 0;
      transcriptFromCache = true;
    } else {
      // Cache miss - proceed with Whisper transcription
      try {
        const whisperPrompt = buildWhisperPrompt(tableSchema);
        
        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: language as 'en' | 'he' | undefined,
          response_format: 'json',
          prompt: whisperPrompt,
        });
        transcript = transcription.text;
        transcriptionDuration = Date.now() - transcriptionStartTime;

        // Cache the transcription for future use
        await transcriptCache.set(audioFile, transcript, transcriptionDuration);
        console.log('[VoiceEntry] Transcription complete and cached:', { transcript, duration: transcriptionDuration });
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
    }

    // Early Exit: Check for known Whisper hallucinations
    if (isWhisperHallucination(transcript)) {
      console.log('[VoiceEntry] Detected Whisper hallucination, skipping GPT call:', transcript);
      const totalDuration = Date.now() - totalStartTime;
      
      return NextResponse.json({
        success: true,
        data: {
          entity: null,
          entityMatch: null,
          value: null,
          valueValid: false,
          action: 'ERROR' as const,
          error: 'Empty or invalid audio detected',
          transcript,
          transcriptionDuration,
          parsingDuration: 0,
          totalDuration,
          pathTaken: 'LLM_FALLBACK',
        },
      });
    }

    // Step 2: Parse transcript with optimized cascading strategy
    console.log('[VoiceEntry] Starting parsing with cache check...');
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

    // ═══════════════════════════════════════════════════════════
    // OPTIMIZATION 2: Check entity recognition cache
    // ═══════════════════════════════════════════════════════════
    const cachedEntity = entityCache.get(transcript, tableId);
    
    if (cachedEntity) {
      console.log('[VoiceEntry] 🚀 ENTITY_CACHE_HIT: Saved ~1500ms LLM call');
      const parsingDuration = Date.now() - parsingStartTime;
      const totalDuration = Date.now() - totalStartTime;

      // Validate the cached value against current column
      const normalizedValue = normalizeValue(cachedEntity.value, activeColumn);
      const validation = validateValue(normalizedValue, activeColumn.type, activeColumn.validation);

      const responsePayload: ParsedResult = {
        entity: cachedEntity.entity,
        entityMatch: {
          original: cachedEntity.entity,
          matched: cachedEntity.entity,
          confidence: cachedEntity.confidence,
          matchType: cachedEntity.matchType,
        },
        value: validation.valid ? normalizedValue : null,
        valueValid: validation.valid,
        action: 'UPDATE_CELL' as const,
        reasoning: `Cached result (saved ~1500ms LLM call)`,
        duration: totalDuration,
      };

      logPerformanceMetrics({
        transcript,
        transcriptionDuration,
        parsingDuration,
        totalDuration,
        matchType: cachedEntity.matchType,
        cached: true,
        pathTaken: 'ENTITY_CACHE_HIT',
      });

      return NextResponse.json({
        success: true,
        data: {
          ...responsePayload,
          transcript,
          transcriptionDuration,
          parsingDuration,
          totalDuration,
          cached: true,
          matchType: cachedEntity.matchType,
          pathTaken: 'ENTITY_CACHE_HIT',
        },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // OPTIMIZATION 3: Quick entity extraction (Fast Path)
    // ═══════════════════════════════════════════════════════════
    const quickExtract = extractEntityQuick(transcript);
    
    if (quickExtract) {
      console.log('[VoiceEntry] Quick extraction found pattern:', quickExtract);
      
      // Try non-LLM matching first (Levels 1-3)
      const entities = tableSchema.rows.map((r) => r.label);
      const matchResult = match(quickExtract.entity, entities, {
        useCache: true,
        usePhonetic: true,
        useFuzzy: true,
        fuzzyThreshold: 2,
      });
      
      if (matchResult.matched && matchResult.confidence >= 0.85 && matchResult.matchType !== 'none') {
        console.log('[VoiceEntry] 🎯 FAST_PATH: Non-LLM match successful');
        const parsingDuration = Date.now() - parsingStartTime;
        const totalDuration = Date.now() - totalStartTime;

        // Validate the extracted value
        const normalizedValue = normalizeValue(quickExtract.value, activeColumn);
        const validation = validateValue(normalizedValue, activeColumn.type, activeColumn.validation);

        const responsePayload: ParsedResult = {
          entity: matchResult.matched,
          entityMatch: {
            original: quickExtract.entity,
            matched: matchResult.matched,
            confidence: matchResult.confidence,
            matchType: matchResult.matchType,
          },
          value: validation.valid ? normalizedValue : null,
          valueValid: validation.valid,
          action: 'UPDATE_CELL' as const,
          reasoning: `Fast path: ${matchResult.matchType} match`,
          duration: totalDuration,
        };

        // Cache this result for future use
        entityCache.set(transcript, tableId, {
          transcript,
          entity: matchResult.matched,
          value: quickExtract.value,
          confidence: matchResult.confidence,
          matchType: matchResult.matchType,
        });

        logPerformanceMetrics({
          transcript,
          transcriptionDuration,
          parsingDuration,
          totalDuration,
          matchType: matchResult.matchType,
          cached: false,
          pathTaken: 'FAST_PATH',
        });

        return NextResponse.json({
          success: true,
          data: {
            ...responsePayload,
            transcript,
            transcriptionDuration,
            parsingDuration,
            totalDuration,
            cached: false,
            matchType: matchResult.matchType,
            pathTaken: 'FAST_PATH',
          },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // OPTIMIZATION 4: LLM Fallback (Last Resort)
    // ═══════════════════════════════════════════════════════════
    console.warn('[VoiceEntry] ⚠️ LLM_FALLBACK: Fast path failed, falling back to GPT');
    const llmStartTime = Date.now();

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

    const llmDuration = Date.now() - llmStartTime;
    const parsingDuration = Date.now() - parsingStartTime;
    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('LLM returned empty content');
    }

    const parsedResult = parseCompletion(rawContent);
    
    // Run final fuzzy matching on LLM result
    const entities = tableSchema.rows.map((r) => r.label);
    const finalMatch = match(parsedResult.entity || '', entities, {
      useCache: true,
      usePhonetic: true,
      useFuzzy: true,
      fuzzyThreshold: 2,
    });

    const matchedEntity = finalMatch.matched || parsedResult.entity;
    const normalizedValue = normalizeValue(parsedResult.value, activeColumn);
    const validation = validateValue(normalizedValue, activeColumn.type, activeColumn.validation);

    const totalDuration = Date.now() - totalStartTime;

    const responsePayload: ParsedResult = {
      ...parsedResult,
      entity: matchedEntity,
      entityMatch: {
        original: parsedResult.entity,
        matched: matchedEntity,
        confidence: finalMatch.confidence || parsedResult.entityMatch?.confidence || 0,
        matchType: 'semantic',
      },
      value: validation.valid ? normalizedValue : null,
      valueValid: validation.valid,
      duration: totalDuration,
      error: validation.valid ? parsedResult.error : validation.error ?? parsedResult.error,
    };

    // Cache LLM result (especially important for expensive calls)
    if (matchedEntity && responsePayload.entityMatch && responsePayload.entityMatch.confidence >= 0.7) {
      entityCache.set(transcript, tableId, {
        transcript,
        entity: matchedEntity,
        value: parsedResult.value,
        confidence: responsePayload.entityMatch.confidence,
        matchType: 'semantic',
      });
    }

    logPerformanceMetrics({
      transcript,
      transcriptionDuration,
      parsingDuration,
      totalDuration,
      matchType: 'semantic',
      cached: false,
      pathTaken: 'LLM_FALLBACK',
      llmDuration,
    });

    console.log('[VoiceEntry] Complete:', {
      transcript,
      transcriptionDuration,
      parsingDuration,
      llmDuration,
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
        cached: false,
        matchType: 'semantic',
        pathTaken: 'LLM_FALLBACK',
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

/**
 * Build a domain-specific prompt for Whisper to bias against hallucinations
 * This helps Whisper understand the context and reduces false transcriptions
 */
function buildWhisperPrompt(tableSchema: TableSchema): string {
  // Take up to 10 row labels as examples
  const exampleEntities = tableSchema.rows.slice(0, 10).map((row) => row.label);
  
  // Add common value patterns
  const commonPatterns = [
    'numbers',
    'scores',
    'grades',
    '100',
    '95',
    '85',
    'update cell',
    'Student A',
    'Student B',
    'John',
    'Mary',
  ];
  
  // Combine entities and patterns
  const allExamples = [...exampleEntities, ...commonPatterns];
  
  // Whisper prompt should be concise but representative
  // Limit to ~200 characters to stay within OpenAI's recommendation
  return allExamples.slice(0, 20).join(', ') + '.';
}

/**
 * Quick entity extraction using regex patterns
 * Handles common patterns like "Student A, 84" or "John Smith, 92"
 * Based on: docs/10_PERFORMANCE.md Section 4.5
 */
function extractEntityQuick(transcript: string): { entity: string; value: any } | null {
  const patterns = [
    /^(.+?),\s*(\d+\.?\d*)$/,           // "Student A, 84"
    /^(.+?)\s+(\d+\.?\d*)$/,            // "Student A 84"
    /^(.+?),\s*([a-zA-Z]+)$/,           // "Student A, present"
    /^(.+?)\s+([a-zA-Z]+)$/,            // "Student A present"
  ];
  
  for (const pattern of patterns) {
    const match = transcript.trim().match(pattern);
    if (match) {
      const entity = match[1].trim();
      const value = isNaN(Number(match[2])) ? match[2] : Number(match[2]);
      return { entity, value };
    }
  }
  
  return null;
}

/**
 * Performance monitoring and logging
 * Based on: docs/10_PERFORMANCE.md Section 8.3
 */
function logPerformanceMetrics(metrics: {
  transcript: string;
  transcriptionDuration: number;
  parsingDuration: number;
  totalDuration: number;
  matchType: 'exact' | 'phonetic' | 'fuzzy' | 'semantic';
  cached: boolean;
  pathTaken: 'TRANSCRIPT_CACHE_HIT' | 'ENTITY_CACHE_HIT' | 'FAST_PATH' | 'LLM_FALLBACK';
  llmDuration?: number;
}): void {
  const { 
    transcript, 
    transcriptionDuration, 
    parsingDuration, 
    totalDuration, 
    matchType, 
    cached, 
    pathTaken,
    llmDuration 
  } = metrics;

  // Performance budget from docs/10_PERFORMANCE.md
  const BUDGET = {
    totalE2EOptimal: 1800,  // Optimal (no LLM) P50 (ms)
    totalE2E: 3500,         // Total pipeline P95 (ms)
  };

  const exceedsBudget = totalDuration > BUDGET.totalE2E;
  const isOptimal = totalDuration <= BUDGET.totalE2EOptimal;

  let recommendation = '';
  if (pathTaken === 'LLM_FALLBACK') {
    recommendation = '⚠️ LLM fallback used. Consider improving fuzzy matching or caching this entity.';
  } else if (isOptimal) {
    recommendation = '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.';
  }

  const logEntry = {
    transcript: transcript.substring(0, 50),
    pathTaken,
    matchType,
    cached,
    transcriptionDuration: `${transcriptionDuration}ms`,
    parsingDuration: `${parsingDuration}ms`,
    llmDuration: llmDuration ? `${llmDuration}ms` : 'N/A',
    totalDuration: `${totalDuration}ms`,
    budget: `${BUDGET.totalE2E}ms`,
    exceedsBudget,
    isOptimal,
    recommendation,
  };

  if (exceedsBudget) {
    console.warn('[Performance] ⚠️ BUDGET EXCEEDED:', logEntry);
  } else {
    console.log('[Performance] ✅', logEntry);
  }

  // Log cache statistics periodically
  if (Math.random() < 0.1) {
    const stats = entityCache.getStats();
    console.log('[EntityCache] Statistics:', {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
      size: stats.size,
      estimatedTimeSaved: `${(stats.estimatedTimeSaved / 1000).toFixed(1)}s`,
    });
  }
}

/**
 * Check if transcript is a known Whisper hallucination
 * Returns true if we should skip GPT processing to save costs
 */
function isWhisperHallucination(transcript: string): boolean {
  const normalized = transcript.trim().toLowerCase();
  
  // Empty or very short transcripts
  if (normalized.length === 0 || normalized.length < 2) {
    return true;
  }
  
  // Known Whisper hallucinations
  const hallucinations = [
    'thank you',
    'thank you.',
    'thank you for watching',
    'thank you for watching.',
    'thank you for your time',
    'thank you for your time.',
    'thanks for watching',
    'thanks for watching.',
    'bye',
    'bye.',
    'goodbye',
    'goodbye.',
    '...',
    '. . .',
    'music',
    '[music]',
    '(music)',
    'silence',
    '[silence]',
    '(silence)',
  ];
  
  // Check exact matches
  if (hallucinations.includes(normalized)) {
    return true;
  }
  
  // Check if it's just punctuation
  if (/^[.,!?;:\s]+$/.test(normalized)) {
    return true;
  }
  
  return false;
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
