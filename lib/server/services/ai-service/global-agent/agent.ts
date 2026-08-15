/**
 * Global Agent
 *
 * A tool-calling agent scoped to one `@BaseList` mention, spanning every
 * `Table` linked to it. Mirrors grid-agent.ts's guardrails, but `tableId` is
 * a per-tool-call, model-supplied argument (validated against the resolved
 * BaseList's table-id set) instead of one server-injected constant.
 *
 * Guardrails (the LLM proposes, TypeScript disposes):
 * - The mentioned BaseList is resolved and ownership-checked server-side via
 *   `resolveMentionContext` — never trusted from raw client input.
 * - Every tool call's `tableId` is checked against the resolved BaseList's
 *   linked tables, and every `columnKey` against that specific table's real
 *   columns, before executing; an invalid one triggers a correction round.
 * - `updateCellsBatch` is only ever proposed and cached; the write itself
 *   happens later, exactly as previewed, via `executeUpdateCellsBatch`.
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  GlobalQueryGridDataArgsSchema,
  GlobalUpdateCellsBatchArgsSchema,
  GlobalGetGridSummaryArgsSchema,
  type Mention,
  type GlobalAgentTurnResponse,
  type GlobalCellUpdate,
  type QueryGridDataResult,
} from '@/lib/shared/types/ai';
import { resolveMentionContext } from '@/lib/server/services/ai-service/shared/context';
import { getTableColumnsForAgent, queryGridData, getGridSummary } from '@/lib/server/services/ai-service/tools/grid-tools';
import {
  globalAgentTools,
  buildGlobalSystemPrompt,
  type GlobalAgentTable,
} from './prompts';
import { pendingGlobalActionCache } from '@/lib/server/cache/global-agent-cache';
import { openai } from '@/lib/server/services/ai-service/shared/openai-client';
import { AI_MODELS, AI_LIMITS } from '@/lib/server/services/ai-service/shared/config';

const MAX_TOOL_ROUNDS = AI_LIMITS.MAX_TOOL_ROUNDS;
const MAX_CORRECTION_ROUNDS = AI_LIMITS.MAX_CORRECTION_ROUNDS;

export interface RunGlobalAgentTurnParams {
  userId: string;
  organizationIds: string[];
  mention: Mention;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface GlobalAgentUsage {
  inputTokens: number;
  outputTokens: number;
}

export type GlobalAgentTurnResult = GlobalAgentTurnResponse & { usage: GlobalAgentUsage };

export async function runGlobalAgentTurn(params: RunGlobalAgentTurnParams): Promise<GlobalAgentTurnResult> {
  const { userId, organizationIds, mention, message, history = [] } = params;
  const usage: GlobalAgentUsage = { inputTokens: 0, outputTokens: 0 };

  const [context] = await resolveMentionContext(userId, organizationIds, [mention]);

  const tableRows = await prisma.table.findMany({
    where: { baseListId: context.baseListId },
    select: { id: true, name: true },
  });

  if (tableRows.length === 0) {
    return { answer: `The BaseList "${context.name}" has no linked tables yet.`, usage };
  }

  const tables: GlobalAgentTable[] = await Promise.all(
    tableRows.map(async (t) => ({
      tableId: t.id,
      name: t.name,
      columns: await getTableColumnsForAgent(t.id, userId),
    }))
  );
  const tableNameById = new Map(tables.map((t) => [t.tableId, t.name]));
  const columnKeysByTable = new Map(tables.map((t) => [t.tableId, new Set(t.columns.map((c) => c.key))]));

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildGlobalSystemPrompt(context.name, tables) },
    ...history.map((h) => ({ role: h.role, content: h.content }) as ChatCompletionMessageParam),
    { role: 'user', content: message },
  ];

  let lastQueryResult: (QueryGridDataResult & { tableId: string }) | null = null;
  let correctionRounds = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.CHAT,
      messages,
      tools: globalAgentTools,
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
                rows: lastQueryResult.rows.map((r) => ({
                  rowKey: r.rowKey,
                  representativeLabel: r.representativeLabel,
                  tableId: lastQueryResult!.tableId,
                })),
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

      const correction = validateAndBuildCorrection(name, rawArgs, columnKeysByTable);
      if (correction) {
        correctionRounds++;
        if (correctionRounds > MAX_CORRECTION_ROUNDS) {
          return { answer: `I couldn't resolve a valid table/column for that request.`, usage };
        }
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: correction });
        continue;
      }

      if (name === 'queryGridData') {
        const { tableId, ...args } = GlobalQueryGridDataArgsSchema.parse(JSON.parse(rawArgs));
        const result = await queryGridData(tableId, userId, args);
        lastQueryResult = { ...result, tableId };
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      } else if (name === 'getGridSummary') {
        const { tableId } = GlobalGetGridSummaryArgsSchema.parse(JSON.parse(rawArgs));
        const result = await getGridSummary(tableId, userId);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      } else if (name === 'updateCellsBatch') {
        const { tableId, updates } = GlobalUpdateCellsBatchArgsSchema.parse(JSON.parse(rawArgs));
        const actionId = randomUUID();
        const updatesWithTable: GlobalCellUpdate[] = updates.map((u) => ({ ...u, tableId }));
        const summary = buildUpdateSummary(updatesWithTable, tableNameById.get(tableId) ?? tableId);
        pendingGlobalActionCache.set({
          actionId,
          kind: 'updateCellsBatch',
          summary,
          updates: updatesWithTable,
          userId,
        });
        return { pendingAction: { actionId, kind: 'updateCellsBatch', summary, updates: updatesWithTable }, usage };
      } else {
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: `Unknown tool: ${name}` });
      }
    }
  }

  return { answer: "I wasn't able to complete that — could you rephrase?", usage };
}

/**
 * Zod-parses `rawArgs` against the matching tool's args schema and checks
 * the referenced `tableId` and every referenced `columnKey` (scoped to that
 * table) against real data. Returns a tool-result message string to send
 * back to the model if a correction is needed, or null if the call is valid.
 */
function validateAndBuildCorrection(
  toolName: string,
  rawArgs: string,
  columnKeysByTable: Map<string, Set<string>>
): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    return 'Invalid JSON arguments. Please retry with valid JSON.';
  }

  let tableId: string | undefined;
  const referencedKeys: string[] = [];

  if (toolName === 'queryGridData') {
    const result = GlobalQueryGridDataArgsSchema.safeParse(parsed);
    if (!result.success) return `Invalid arguments: ${result.error.message}`;
    tableId = result.data.tableId;
    referencedKeys.push(...result.data.filters.map((f) => f.columnKey));
  } else if (toolName === 'updateCellsBatch') {
    const result = GlobalUpdateCellsBatchArgsSchema.safeParse(parsed);
    if (!result.success) return `Invalid arguments: ${result.error.message}`;
    tableId = result.data.tableId;
    referencedKeys.push(...result.data.updates.map((u) => u.columnKey));
  } else if (toolName === 'getGridSummary') {
    const result = GlobalGetGridSummaryArgsSchema.safeParse(parsed);
    if (!result.success) return `Invalid arguments: ${result.error.message}`;
    tableId = result.data.tableId;
  } else {
    return null;
  }

  const validColumnKeys = tableId ? columnKeysByTable.get(tableId) : undefined;
  if (!tableId || !validColumnKeys) {
    return `Unknown tableId "${tableId}". Valid tables: ${[...columnKeysByTable.keys()].join(', ')}`;
  }

  const unknown = referencedKeys.find((key) => !validColumnKeys.has(key));
  if (unknown) {
    return `Unknown column "${unknown}" for that table. Valid columns: ${[...validColumnKeys].join(', ')}`;
  }

  return null;
}

function buildUpdateSummary(updates: GlobalCellUpdate[], tableName: string): string {
  if (updates.length === 1) {
    const [u] = updates;
    return `Set ${u.columnKey} to ${JSON.stringify(u.value)} for 1 row in "${tableName}"`;
  }
  return `Update ${updates.length} cells across ${new Set(updates.map((u) => u.rowKey)).size} rows in "${tableName}"`;
}
