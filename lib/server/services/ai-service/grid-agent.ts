/**
 * Grid Agent
 *
 * A tool-calling agent scoped to one active table: read tools
 * (`queryGridData`, `getGridSummary`) execute automatically, while
 * `updateCellsBatch` NEVER executes directly — it always returns a
 * `pendingAction` diff preview requiring explicit user confirmation via
 * `POST /api/ai/grid-agent/execute`. Implements:
 * docs/features/03_ai_table_agent.md §4.
 *
 * Guardrails (the LLM proposes, TypeScript disposes — see doc §1.5):
 * - `tableId` is never a tool parameter — it is injected server-side and
 *   fixed for the whole turn.
 * - Every `columnKey` a tool call references is validated against this
 *   table's real TableColumn rows before executing; an unknown key triggers
 *   a correction round instead of execution (max 2 correction rounds).
 * - `updateCellsBatch` is only ever proposed and cached; the write itself
 *   happens later, exactly as previewed, via `executeUpdateCellsBatch`.
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { randomUUID } from 'crypto';
import {
  QueryGridDataArgsSchema,
  UpdateCellsBatchArgsSchema,
  GetGridSummaryArgsSchema,
  type GridAgentTurnResponse,
  type QueryGridDataResult,
} from '@/lib/shared/types/ai';
import {
  getTableColumnsForAgent,
  queryGridData,
  getGridSummary,
  UnknownColumnKeyError,
} from '@/lib/server/services/ai-grid-tools';
import { gridAgentTools, buildSystemPrompt } from '@/lib/server/services/ai-service/grid-agent-prompts';
import { pendingGridActionCache } from '@/lib/server/cache/grid-agent-cache';
import { openai } from '@/lib/server/services/ai-service/shared/openai-client';
import { AI_MODELS, AI_LIMITS } from '@/lib/server/services/ai-service/shared/config';

const MAX_TOOL_ROUNDS = AI_LIMITS.MAX_TOOL_ROUNDS;
const MAX_CORRECTION_ROUNDS = AI_LIMITS.MAX_CORRECTION_ROUNDS;

export interface RunGridAgentTurnParams {
  userId: string;
  tableId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface GridAgentUsage {
  inputTokens: number;
  outputTokens: number;
}

export type GridAgentTurnResult = GridAgentTurnResponse & { usage: GridAgentUsage };

export async function runGridAgentTurn(params: RunGridAgentTurnParams): Promise<GridAgentTurnResult> {
  const { userId, tableId, message, history = [] } = params;

  const columns = await getTableColumnsForAgent(tableId, userId);
  const columnKeys = new Set(columns.map((c) => c.key));

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(columns) },
    ...history.map((h) => ({ role: h.role, content: h.content }) as ChatCompletionMessageParam),
    { role: 'user', content: message },
  ];

  const usage: GridAgentUsage = { inputTokens: 0, outputTokens: 0 };
  let lastQueryResult: QueryGridDataResult | null = null;
  let correctionRounds = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      messages,
      tools: gridAgentTools,
      tool_choice: 'auto',
    });

    usage.inputTokens += completion.usage?.prompt_tokens ?? 0;
    usage.outputTokens += completion.usage?.completion_tokens ?? 0;

    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) throw new Error('LLM returned no message');

    const toolCalls = responseMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return {
        answer: responseMessage.content ?? '',
        ...(lastQueryResult
          ? {
              evidence: {
                rows: lastQueryResult.rows.map((r) => ({ rowKey: r.rowKey, representativeLabel: r.representativeLabel })),
              },
            }
          : {}),
        usage,
      };
    }

    messages.push({
      role: 'assistant',
      content: responseMessage.content,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function') continue;
      const { name, arguments: rawArgs } = toolCall.function;

      const correction = validateAndBuildCorrection(name, rawArgs, columnKeys);
      if (correction) {
        correctionRounds++;
        if (correctionRounds > MAX_CORRECTION_ROUNDS) {
          return { answer: `I couldn't resolve a valid column for that request.`, usage };
        }
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: correction });
        continue;
      }

      if (name === 'queryGridData') {
        const args = QueryGridDataArgsSchema.parse(JSON.parse(rawArgs));
        const result = await queryGridData(tableId, userId, args);
        lastQueryResult = result;
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      } else if (name === 'getGridSummary') {
        const args = GetGridSummaryArgsSchema.parse(JSON.parse(rawArgs));
        void args;
        const result = await getGridSummary(tableId, userId);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      } else if (name === 'updateCellsBatch') {
        const args = UpdateCellsBatchArgsSchema.parse(JSON.parse(rawArgs));
        const actionId = randomUUID();
        const summary = buildUpdateSummary(args.updates);
        pendingGridActionCache.set({
          actionId,
          kind: 'updateCellsBatch',
          summary,
          updates: args.updates,
          tableId,
          userId,
        });
        return { pendingAction: { actionId, kind: 'updateCellsBatch', summary, updates: args.updates }, usage };
      } else {
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `Unknown tool: ${name}` });
      }
    }
  }

  return { answer: "I wasn't able to complete that — could you rephrase?", usage };
}

/**
 * Zod-parses `rawArgs` against the matching tool's args schema and checks
 * every referenced columnKey against the table's real columns. Returns a
 * tool-result message string to send back to the model if a correction is
 * needed, or null if the call is valid and safe to execute.
 */
function validateAndBuildCorrection(
  toolName: string,
  rawArgs: string,
  validColumnKeys: Set<string>
): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    return 'Invalid JSON arguments. Please retry with valid JSON.';
  }

  const referencedKeys: string[] = [];
  if (toolName === 'queryGridData') {
    const result = QueryGridDataArgsSchema.safeParse(parsed);
    if (!result.success) return `Invalid arguments: ${result.error.message}`;
    referencedKeys.push(...result.data.filters.map((f) => f.columnKey));
  } else if (toolName === 'updateCellsBatch') {
    const result = UpdateCellsBatchArgsSchema.safeParse(parsed);
    if (!result.success) return `Invalid arguments: ${result.error.message}`;
    referencedKeys.push(...result.data.updates.map((u) => u.columnKey));
  } else if (toolName === 'getGridSummary') {
    const result = GetGridSummaryArgsSchema.safeParse(parsed);
    if (!result.success) return `Invalid arguments: ${result.error.message}`;
  }

  const unknown = referencedKeys.find((key) => !validColumnKeys.has(key));
  if (unknown) {
    return `Unknown column "${unknown}". Valid columns: ${[...validColumnKeys].join(', ')}`;
  }

  return null;
}

function buildUpdateSummary(updates: Array<{ rowKey: string; columnKey: string; value: unknown }>): string {
  if (updates.length === 1) {
    const [u] = updates;
    return `Set ${u.columnKey} to ${JSON.stringify(u.value)} for 1 row`;
  }
  return `Update ${updates.length} cells across ${new Set(updates.map((u) => u.rowKey)).size} rows`;
}
