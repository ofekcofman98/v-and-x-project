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
import { trackVoiceMetrics } from '@/lib/monitoring/voice-metrics';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// export const runtime = 'nodejs';
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

const ParseRequestSchema = z.object({
  transcript: z.string().min(1),
  tableSchema: TableSchemaInput,
  activeCell: z.object({
    rowId: z.string(),
    columnId: z.string(),
  }),
  navigationMode: z.enum(['column-first', 'row-first']),
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

type ParseRequest = z.infer<typeof ParseRequestSchema>;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: { code: 'OPENAI_KEY_MISSING', message: 'OpenAI API key is not configured.' } },
        { status: 500 }
      );
    }

    const rawBody = await req.json();
    const parsed = ParseRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Payload is invalid.', details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { transcript, activeCell, navigationMode } = parsed.data;
    const tableSchema: TableSchema = parsed.data.tableSchema;
    const activeColumn = tableSchema.columns.find((col) => col.id === activeCell.columnId);
    const activeRow = tableSchema.rows.find((row) => row.id === activeCell.rowId);

    if (!activeColumn || !activeRow) {
      return NextResponse.json(
        { success: false, error: { code: 'CELL_NOT_FOUND', message: 'Active cell cannot be resolved.' } },
        { status: 400 }
      );
    }

    const prompt = buildParsePrompt({
      transcript,
      tableSchema,
      activeCell,
      navigationMode,
    });

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
      temperature: 0.1,
      max_tokens: 256,
    });

    const duration = Date.now() - startTime;
    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('LLM returned empty content');
    }

    const parsedResult = parseCompletion(rawContent);
    const normalizedValue = normalizeValue(parsedResult.value, activeColumn);
    const validation = validateValue(normalizedValue, activeColumn.type, activeColumn.validation);
    const responsePayload: ParsedResult = {
      ...parsedResult,
      value: validation.valid ? normalizedValue : null,
      valueValid: validation.valid,
      duration,
      error: validation.valid ? parsedResult.error : validation.error ?? parsedResult.error,
    };

    console.log('[Parse] success', {
      duration,
      transcript,
      result: responsePayload,
    });

    // Track server-side metrics
    if (typeof process !== 'undefined') {
      console.log('[Performance] parse:', {
        phase: 'parse',
        duration,
        success: true,
        exceeded: duration > 1000,
      });
    }

    return NextResponse.json({ success: true, data: responsePayload });
  } catch (error) {
    console.error('[Parse API]', error);
    
    // Track failure
    if (typeof process !== 'undefined') {
      console.log('[Performance] parse:', {
        phase: 'parse',
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    return NextResponse.json(
      {
        success: false,
        error: { code: 'PARSE_FAILED', message: 'We could not interpret that voice command right now.' },
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
  activeCell: ParseRequest['activeCell'];
  navigationMode: ParseRequest['navigationMode'];
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