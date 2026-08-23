/**
 * Parse Service
 * Implements the LLM-based transcript → structured result pipeline
 * for the /api/parse endpoint.
 *
 * Extracted from: app/api/parse/route.ts
 * Based on: docs/05_VOICE_PIPELINE.md
 *
 * Error contract:
 *   Throws a plain Error on hard failures (empty LLM response, schema
 *   mismatch). The route layer catches these and returns a 500 response.
 */

import { z } from 'zod';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { ParsedResult } from '@/lib/shared/types/voice-pipeline';
import { parseForColumn } from '@/lib/server/parsers/registry';
import { openai } from '@/lib/server/services/ai-service/shared/openai-client';
import { AI_MODELS, AI_TUNING } from '@/lib/server/services/ai-service/shared/config';

// ─────────────────────────────────────────────────────────────────────────────
// Internal Zod schema — validates the raw LLM JSON response
// ─────────────────────────────────────────────────────────────────────────────

const LlmResponseSchema = z.object({
  entity: z.string().nullable(),
  entityMatch: z
    .object({
      original: z.string().nullable(),
      matched: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      matchType: z.enum(['exact', 'fuzzy', 'phonetic', 'semantic']).nullable(),
    })
    .nullable(),
  value: z.unknown(),
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

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface TranscriptParseParams {
  transcript: string;
  tableSchema: TableSchema;
  activeCell: { rowId: string; columnId: string };
  navigationMode: 'column-first' | 'row-first';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main service function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the full LLM-based parse pipeline for a single transcript.
 *
 * @param params - Transcript, table schema, active cell, and navigation mode
 * @returns A fully validated and normalised ParsedResult with timing data
 * @throws Error if the LLM returns empty content or an invalid schema
 */
export async function executeTranscriptParse(
  params: TranscriptParseParams
): Promise<ParsedResult> {
  const { transcript, tableSchema, activeCell, navigationMode } = params;

  const activeColumn = tableSchema.columns.find((col) => col.id === activeCell.columnId);

  if (!activeColumn) {
    throw new Error(`Column with id "${activeCell.columnId}" not found in tableSchema`);
  }

  const prompt = buildParsePrompt({ transcript, tableSchema, activeCell, navigationMode });

  const startTime = Date.now();

  const completion = await openai.chat.completions.create({
    model: AI_MODELS.CHAT,
    messages: [
      {
        role: 'system',
        content:
          'You are a data entry assistant that extracts entities and values from voice transcripts.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: AI_TUNING.JSON_TEMPERATURE,
    max_tokens: AI_TUNING.MAX_TOKENS.PARSE,
  });

  const duration = Date.now() - startTime;
  const rawContent = completion.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('LLM returned empty content');
  }

  const parsedResult = parseCompletion(rawContent);
  const parsed = parseForColumn(parsedResult.value, activeColumn, { language: 'auto' });

  return {
    ...parsedResult,
    value: parsed.value,
    valueValid: parsed.valid,
    duration,
    error: parsed.valid ? parsedResult.error : (parsed.error ?? parsedResult.error),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildParsePrompt(params: {
  transcript: string;
  tableSchema: TableSchema;
  activeCell: { rowId: string; columnId: string };
  navigationMode: 'column-first' | 'row-first';
}): string {
  const { transcript, tableSchema, activeCell, navigationMode } = params;
  const currentColumn = tableSchema.columns.find((col) => col.id === activeCell.columnId);
  const columnType = currentColumn?.type ?? ColumnType.TEXT;

  const availableEntities = tableSchema.rows.map((row) => row.label).join(', ');

  return `
You are a lightning-fast data extraction assistant.
Your job is to extract the intended entity and the value from the transcript.

CURRENT STATE:
- Navigation mode: ${navigationMode}
- Expected Column Type: ${columnType} (e.g. if 'number', convert word numbers like "eighty" to 80)

AVAILABLE ENTITIES IN TABLE (Voice Key):
[${availableEntities}]

USER SAID: "${transcript}"

INSTRUCTIONS:
1. Match the spoken entity to ONE of the exact names in the AVAILABLE ENTITIES list. 
2. If it's a clear match (even with slight mispronunciation), return that exact name.
3. Extract the target value.

RESPOND ONLY IN JSON (strictly matching this schema):
{
  "entity": "The exact entity name you heard",
  "entityMatch": {
    "original": "The raw word heard",
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

function parseCompletion(content: string): ParsedResult {
  const parsed: unknown = JSON.parse(content);
  const validated = LlmResponseSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error('LLM output did not match expected schema');
  }

  return validated.data;
}
