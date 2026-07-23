import { z } from 'zod';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { ColumnDefinition, TableSchema } from '@/lib/shared/types/table-schema';
import type { ParsedResult } from '@/lib/shared/types/voice-pipeline';
import { openai } from './openai-client';

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for LLM output validation
// ─────────────────────────────────────────────────────────────────────────────

export const ParsedResultSchema = z.object({
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
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

export function buildParsePrompt(params: {
  transcript: string;
  tableSchema: TableSchema;
  activeCell: { rowKey: string; tableColumnId: string };
  navigationMode: 'column-first' | 'row-first';
}): string {
  const { transcript, tableSchema, activeCell, navigationMode } = params;
  const currentColumn = tableSchema.columns.find((col) => col.id === activeCell.tableColumnId);
  const columnType = currentColumn?.type ?? ColumnType.TEXT;

  // Deliberately omit the rows/entities array to keep the context diet.
  // Entity matching is handled separately by the matcher chain.
  return `
You are a lightning-fast data extraction assistant.
Your ONLY job is to extract the spoken entity (if any) and the value from the transcript.
Do NOT attempt to match the entity against any database. Return EXACTLY what was heard.

A cell is already selected (from a click, or from filling the previous column
of this same row) — the user is often expected to say ONLY the value, with no
name/entity at all. If the transcript does not mention any name/entity and is
just a value, set "entity" and "entityMatch" to null. Only populate "entity"
when a name/entity was actually spoken.

CURRENT STATE:
- Navigation mode: ${navigationMode}
- Expected Column Type: ${columnType} (e.g. if 'number', convert word numbers like "eighty" to 80)

USER SAID: "${transcript}"

RESPOND ONLY IN JSON (strictly matching this schema):
{
  "entity": "The exact entity name you heard, or null if none was mentioned",
  "entityMatch": null,
  "value": "The extracted value",
  "valueValid": true,
  "action": "UPDATE_CELL",
  "reasoning": "Extracted raw data from transcript"
}

Example when an entity IS mentioned ("Noa Cohen, 21"):
{
  "entity": "Noa Cohen",
  "entityMatch": { "original": "Noa Cohen", "matched": "Noa Cohen", "confidence": 1.0, "matchType": "exact" },
  "value": 21,
  "valueValid": true,
  "action": "UPDATE_CELL",
  "reasoning": "Extracted raw data from transcript"
}
`.trim();
}

/**
 * Prompt for the Row-first mid-row shortcut: the row is already known from
 * the Smart Pointer, so no entity/name extraction is needed at all — only
 * normalize the spoken value for the current column's type.
 */
function buildValueOnlyPrompt(transcript: string, columnType: ColumnType): string {
  return `
You are a lightning-fast data extraction assistant.
The row has already been selected — your ONLY job is to extract and normalize
the value from the transcript for the given column type. There is no entity
or name to extract; ignore that entirely.

Expected Column Type: ${columnType} (e.g. if 'number', convert word numbers like "eighty five" to 85)

USER SAID: "${transcript}"

RESPOND ONLY IN JSON (strictly matching this schema):
{
  "value": "The extracted, normalized value"
}
`.trim();
}

const ValueOnlySchema = z.object({ value: z.unknown() });

/**
 * Calls GPT-4o-mini to normalize a bare value (e.g. a spoken word-number)
 * with no entity/matching involved — used only by the Row-first mid-row
 * shortcut once the direct parseForColumn attempt has failed.
 */
export async function extractValueOnlyViaLLM(transcript: string, activeColumn: ColumnDefinition): Promise<unknown> {
  const prompt = buildValueOnlyPrompt(transcript, activeColumn.type);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a data extraction assistant that normalizes spoken values.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 64,
  });

  const rawContent = completion.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('LLM returned empty content');
  }

  const parsed: unknown = JSON.parse(rawContent);
  const validated = ValueOnlySchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error('LLM output did not match expected schema');
  }

  return validated.data.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM output parsing
// ─────────────────────────────────────────────────────────────────────────────

export function parseCompletion(content: string): ParsedResult {
  const parsed: unknown = JSON.parse(content);
  const validated = ParsedResultSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error('LLM output did not match expected schema');
  }

  return validated.data;
}
