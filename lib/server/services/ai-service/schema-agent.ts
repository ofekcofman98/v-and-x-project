/**
 * AI Schema Agent
 *
 * Turns a natural language prompt + resolved `@Mention` context into a
 * validated `TableDraft` via gpt-4o-mini. Implements:
 * docs/features/03_ai_table_agent.md §3.
 *
 * Guardrails (the LLM proposes, TypeScript disposes — see doc §1.5):
 * - The LLM is never asked for `baseListId` or `representativeColumnKey`;
 *   both are computed server-side from the resolved mention context.
 * - Exactly one bounded retry on Zod validation failure, with the validation
 *   error appended to the retry prompt.
 */

import { z } from 'zod';
import {
  TableColumnDraftSchema,
  TableDraftSchema,
  type Mention,
  type SchemaAgentResponse,
  type TableDraft,
} from '@/lib/shared/types/ai';
import { resolveMentionContext, type MentionContext } from '@/lib/server/services/ai-service/context';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/server/services/ai-service/schema-agent-prompts';
import { isIdentityColumn } from '@/lib/shared/utils/identity-column';
import { ColumnType } from '@/lib/shared/types/column-types';
import { validateFormula } from '@/lib/shared/utils/formula';
import { openai } from '@/lib/server/services/ai-service/shared/openai-client';
import { AI_MODELS, AI_TUNING } from '@/lib/server/services/ai-service/shared/config';

// What we actually ask the LLM for — no baseListId, no representativeColumnKey.
// Both are computed deterministically server-side (guardrail: LLM never
// controls foreign keys or the entity-matching key).
const LlmTableDraftSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  columns: z.array(TableColumnDraftSchema).min(1).max(30),
});
type LlmTableDraft = z.infer<typeof LlmTableDraftSchema>;

export interface GenerateTableDraftParams {
  userId: string;
  organizationIds: string[];
  prompt: string;
  mentions: Mention[];
}

/**
 * Generates a validated table draft from a prompt and its resolved mentions.
 *
 * @throws Error if the LLM returns empty content, or if its output still
 * fails Zod validation after one retry.
 */
export async function generateTableDraft(
  params: GenerateTableDraftParams
): Promise<SchemaAgentResponse> {
  const { userId, organizationIds, prompt, mentions } = params;

  const contexts = await resolveMentionContext(userId, organizationIds, mentions);
  const primaryContext = contexts[0] ?? null;

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(prompt, contexts);

  const usage = { inputTokens: 0, outputTokens: 0 };

  let llmDraft: LlmTableDraft;
  try {
    const first = await callLlm(systemPrompt, userPrompt);
    accumulateUsage(usage, first);
    llmDraft = LlmTableDraftSchema.parse(JSON.parse(first.content));
  } catch (firstError) {
    // Bounded retry: exactly one extra attempt with the validation error appended.
    const retryPrompt = `${userPrompt}\n\nYour previous response was invalid JSON for the required schema: ${
      (firstError as Error).message
    }\nReturn corrected JSON only, matching the schema exactly.`;
    const retry = await callLlm(systemPrompt, retryPrompt);
    accumulateUsage(usage, retry);
    llmDraft = LlmTableDraftSchema.parse(JSON.parse(retry.content)); // throws on second failure
  }

  const draft = finalizeDraft(llmDraft, primaryContext);

  return { draft, usage };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

async function callLlm(
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const completion = await openai.chat.completions.create({
    model: AI_MODELS.CHAT,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: AI_TUNING.JSON_TEMPERATURE,
    max_tokens: AI_TUNING.MAX_TOKENS.SCHEMA_DRAFT,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');

  return {
    content,
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };
}

function accumulateUsage(
  usage: { inputTokens: number; outputTokens: number },
  result: { promptTokens: number; completionTokens: number }
): void {
  usage.inputTokens += result.promptTokens;
  usage.outputTokens += result.completionTokens;
}

function finalizeDraft(llmDraft: LlmTableDraft, primaryContext: MentionContext | null): TableDraft {
  // Defense-in-depth: even though the prompt tells the model not to, drop any
  // drafted column that duplicates a field already provided by the linked
  // entity list (matched by key or label) — those are already part of every
  // table built from that list and are not this table's responsibility.
  const baseListFieldNames = new Set(
    (primaryContext?.columns ?? []).flatMap((col) => [col.id.toLowerCase(), col.label.toLowerCase()])
  );

  // Dedupe column keys (keep first occurrence), drop base-list duplicates,
  // and renumber order sequentially.
  const seenKeys = new Set<string>();
  const columns = llmDraft.columns
    .filter((col) => {
      if (seenKeys.has(col.key)) return false;
      if (baseListFieldNames.has(col.key.toLowerCase()) || baseListFieldNames.has(col.label.toLowerCase())) {
        return false;
      }
      seenKeys.add(col.key);
      return true;
    })
    .map((col, index) => ({ ...col, order: index }));

  // Defense-in-depth: sanitize computed columns whose formula turned out
  // invalid (dangling/duplicate-dropped reference, non-numeric reference,
  // reference to another computed column, etc.) by downgrading them to a
  // plain NUMBER column rather than failing the whole request.
  const keyedColumns = columns.map((col) => ({ id: col.key, type: col.type as ColumnType }));
  const sanitizedColumns = columns.map((col) => {
    if (col.type !== ColumnType.COMPUTED || !col.formula) return col;
    const errors = validateFormula(col.key, col.formula, keyedColumns);
    if (errors.length === 0) return col;
    return { ...col, type: ColumnType.NUMBER, formula: undefined };
  });

  const baseListId = primaryContext?.baseListId ?? null;

  // representativeColumnKey: for a BaseList-bound table, it must reference a
  // key in the BaseList's OWN schema (identity column heuristic, falling back
  // to its first column) — not the new table's drafted columns. For a
  // standalone table, it must reference one of the drafted columns instead.
  const representativeColumnKey = primaryContext
    ? (primaryContext.columns.find(isIdentityColumn)?.id ?? primaryContext.columns[0]?.id ?? sanitizedColumns[0].key)
    : (sanitizedColumns.find((c) => isIdentityColumn({ id: c.key, label: c.label }))?.key ?? sanitizedColumns[0].key);

  const draft = {
    name: llmDraft.name,
    description: llmDraft.description,
    baseListId,
    representativeColumnKey,
    columns: sanitizedColumns,
  };

  // Defense-in-depth: re-validate the fully assembled draft before returning.
  return TableDraftSchema.parse(draft);
}
