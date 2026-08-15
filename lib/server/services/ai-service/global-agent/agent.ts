/**
 * Global Agent
 *
 * A tool-calling agent scoped to one `@BaseList` mention, spanning every
 * `Table` linked to it. Mirrors grid-agent's guardrails, but `tableId` is
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
 *
 * The round loop, usage accounting, and message bookkeeping live in
 * shared/tool-agent-runner.ts (identical to grid-agent's) — this file
 * supplies only the BaseList-scoped validation/dispatch via `handleToolCall`.
 */

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
import { globalAgentTools, buildGlobalSystemPrompt, type GlobalAgentTable } from './prompts';
import { pendingGlobalActionCache } from '@/lib/server/cache/global-agent-cache';
import { runToolAgent, type ToolCallOutcome } from '@/lib/server/services/ai-service/shared/tool-agent-runner';
import type { AgentUsage } from '@/lib/server/services/ai-service/shared/usage';

export interface RunGlobalAgentTurnParams {
  userId: string;
  organizationIds: string[];
  mention: Mention;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export type GlobalAgentUsage = AgentUsage;

export type GlobalAgentTurnResult = GlobalAgentTurnResponse & { usage: GlobalAgentUsage };

export async function runGlobalAgentTurn(params: RunGlobalAgentTurnParams): Promise<GlobalAgentTurnResult> {
  const { userId, organizationIds, mention, message, history = [] } = params;

  const [context] = await resolveMentionContext(userId, organizationIds, [mention]);

  const tableRows = await prisma.table.findMany({
    where: { baseListId: context.baseListId },
    select: { id: true, name: true },
  });

  if (tableRows.length === 0) {
    return { answer: `The BaseList "${context.name}" has no linked tables yet.`, usage: { inputTokens: 0, outputTokens: 0 } };
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

  let lastQueryResult: (QueryGridDataResult & { tableId: string }) | null = null;

  const handleToolCall = async (
    name: string,
    rawArgs: string
  ): Promise<ToolCallOutcome<GlobalAgentTurnResponse>> => {
    const correction = validateAndBuildCorrection(name, rawArgs, columnKeysByTable);
    if (correction) return { kind: 'correction', content: correction };

    if (name === 'queryGridData') {
      const { tableId, ...args } = GlobalQueryGridDataArgsSchema.parse(JSON.parse(rawArgs));
      const result = await queryGridData(tableId, userId, args);
      lastQueryResult = { ...result, tableId };
      return { kind: 'result', content: JSON.stringify(result) };
    }

    if (name === 'getGridSummary') {
      const { tableId } = GlobalGetGridSummaryArgsSchema.parse(JSON.parse(rawArgs));
      const result = await getGridSummary(tableId, userId);
      return { kind: 'result', content: JSON.stringify(result) };
    }

    if (name === 'updateCellsBatch') {
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
      return {
        kind: 'terminate',
        response: { pendingAction: { actionId, kind: 'updateCellsBatch', summary, updates: updatesWithTable } },
      };
    }

    return { kind: 'result', content: `Unknown tool: ${name}` };
  };

  const { response, usage } = await runToolAgent<GlobalAgentTurnResponse>({
    systemPrompt: buildGlobalSystemPrompt(context.name, tables),
    history,
    message,
    tools: globalAgentTools,
    handleToolCall,
    buildFinalAnswer: (content) => ({
      answer: content,
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
    }),
    buildCorrectionLimitAnswer: () => ({ answer: `I couldn't resolve a valid table/column for that request.` }),
    buildExhaustedAnswer: () => ({ answer: "I wasn't able to complete that — could you rephrase?" }),
  });

  return { ...response, usage };
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
