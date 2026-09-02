// ─────────────────────────────────────────────────────────────────────────────
// LLM-based batch segmentation (fallback when local segmentation is ambiguous)
// docs/features/03_ai_table_agent.md §5.4/§5.5
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { openai } from './openai-client';
import { AI_MODELS, AI_LIMITS, AI_TUNING } from '@/lib/server/services/ai-service/shared/config';
import type { EntityGroup } from './batch-segmentation';

// Zod schema for LLM output validation — mirrors llm-prompts.ts's convention
// of colocating the schema with the call site rather than in shared types.
const BareValueBatchExtractionSchema = z.object({
  entries: z
    .array(
      z.object({
        rawValue: z.string().min(1),
      })
    )
    .min(1)
    .max(30),
});

const EntityValueBatchExtractionSchema = z.object({
  entries: z
    .array(
      z.object({
        entityText: z.string().min(1),
        rawValue: z.string().min(1),
      })
    )
    .min(1)
    .max(30),
});

// docs/features/18_entity_first_navigation.md §6, §8
const EntityGroupBatchExtractionSchema = z.object({
  groups: z
    .array(
      z.object({
        entityText: z.string().min(1),
        rawValues: z.array(z.string().min(1)).min(1),
      })
    )
    .min(1)
    .max(30),
});

const MAX_RETRIES = AI_LIMITS.MAX_RETRIES;

function buildBareValuePrompt(transcript: string): string {
  return `
You are a lightning-fast data extraction assistant.
The row is already selected — your ONLY job is to split the transcript into
the separate values that were spoken, in the order they were spoken. There is
no entity or name to extract; ignore that entirely.

USER SAID: "${transcript}"

RESPOND ONLY IN JSON (strictly matching this schema):
{
  "entries": [{ "rawValue": "85" }, { "rawValue": "90" }]
}
`.trim();
}

function buildEntityValuePrompt(transcript: string): string {
  return `
You are a lightning-fast data extraction assistant.
Your ONLY job is to split the transcript into (entity, value) pairs, in the
order they were spoken. Do NOT attempt to match entities against any
database — return EXACTLY what was heard for each entity.

USER SAID: "${transcript}"

RESPOND ONLY IN JSON (strictly matching this schema):
{
  "entries": [
    { "entityText": "Dan", "rawValue": "85" },
    { "entityText": "Noa", "rawValue": "90" }
  ]
}
`.trim();
}

function buildEntityGroupPrompt(transcript: string): string {
  return `
You are a lightning-fast data extraction assistant.
Your ONLY job is to split the transcript into (entity, values) groups, in the
order they were spoken. An entity is named once, followed by every value
spoken for it, before the next entity (if any). Do NOT attempt to match
entities against any database — return EXACTLY what was heard for each
entity and value.

USER SAID: "${transcript}"

RESPOND ONLY IN JSON (strictly matching this schema):
{
  "groups": [
    { "entityText": "Dana", "rawValues": ["90", "85", "70"] },
    { "entityText": "Yossi", "rawValues": ["70", "60", "55"] }
  ]
}
`.trim();
}

async function callSegmentationLLM(prompt: string): Promise<unknown> {
  const completion = await openai.chat.completions.create({
    model: AI_MODELS.CHAT,
    messages: [
      {
        role: 'system',
        content: 'You are a data extraction assistant that segments multi-entry voice transcripts.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: AI_TUNING.JSON_TEMPERATURE,
    max_tokens: AI_TUNING.MAX_TOKENS.SEGMENTATION,
  });

  const rawContent = completion.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('LLM returned empty content');
  }

  return JSON.parse(rawContent);
}

/**
 * Row-first LLM segmentation fallback: splits a transcript into bare value
 * tokens with one bounded retry on Zod parse failure. Throws after the
 * retry is exhausted — the orchestrator degrades to the single-entry
 * pipeline on failure (docs/features/03_ai_table_agent.md §5.3).
 */
export async function segmentBareValuesViaLLM(transcript: string): Promise<string[]> {
  const prompt = buildBareValuePrompt(transcript);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const parsed = await callSegmentationLLM(prompt);
    const validated = BareValueBatchExtractionSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data.entries.map((e) => e.rawValue);
    }
  }

  throw new Error('LLM batch segmentation (bare-value) failed validation after retry');
}

/**
 * Column-first LLM segmentation fallback: splits a transcript into
 * (entityText, rawValue) pairs with one bounded retry on Zod parse failure.
 * Throws after the retry is exhausted — the orchestrator degrades to the
 * single-entry pipeline on failure (docs/features/03_ai_table_agent.md §5.3).
 */
export async function segmentEntityValuePairsViaLLM(
  transcript: string
): Promise<{ entityText: string; rawValue: string }[]> {
  const prompt = buildEntityValuePrompt(transcript);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const parsed = await callSegmentationLLM(prompt);
    const validated = EntityValueBatchExtractionSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data.entries;
    }
  }

  throw new Error('LLM batch segmentation (entity-value) failed validation after retry');
}

/**
 * Entity-first LLM segmentation fallback: splits a transcript into
 * (entityText, rawValues[]) groups with one bounded retry on Zod parse
 * failure. Throws after the retry is exhausted — the orchestrator degrades
 * to the single-entry pipeline on failure.
 * docs/features/18_entity_first_navigation.md §6
 */
export async function segmentEntityGroupsViaLLM(transcript: string): Promise<EntityGroup[]> {
  const prompt = buildEntityGroupPrompt(transcript);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const parsed = await callSegmentationLLM(prompt);
    const validated = EntityGroupBatchExtractionSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data.groups;
    }
  }

  throw new Error('LLM batch segmentation (entity-group) failed validation after retry');
}
