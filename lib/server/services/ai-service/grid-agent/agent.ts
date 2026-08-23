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
 *
 * The round loop, usage accounting, and message bookkeeping live in
 * shared/tool-agent-runner.ts (identical to global-agent's) — this file
 * supplies only the table-scoped validation/dispatch via `handleToolCall`.
 */

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
} from '@/lib/server/services/ai-service/tools/grid-tools';
import { gridAgentTools, buildSystemPrompt } from './prompts';
import { pendingGridActionCache } from '@/lib/server/cache/grid-agent-cache';
import { runToolAgent, type ToolCallOutcome } from '@/lib/server/services/ai-service/shared/tool-agent-runner';
import type { AgentUsage } from '@/lib/server/services/ai-service/shared/usage';

export interface RunGridAgentTurnParams {
  userId: string;
  tableId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export type GridAgentUsage = AgentUsage;

export type GridAgentTurnResult = GridAgentTurnResponse & { usage: GridAgentUsage };

export async function runGridAgentTurn(params: RunGridAgentTurnParams): Promise<GridAgentTurnResult> {
  const { userId, tableId, message, history = [] } = params;

  const columns = await getTableColumnsForAgent(tableId, userId);
  const columnKeys = new Set(columns.map((c) => c.key));

  let lastQueryResult: QueryGridDataResult | null = null;

  const handleToolCall = async (
    name: string,
    rawArgs: string
  ): Promise<ToolCallOutcome<GridAgentTurnResponse>> => {
    const correction = validateAndBuildCorrection(name, rawArgs, columnKeys);
    if (correction) return { kind: 'correction', content: correction };

    if (name === 'queryGridData') {
      const args = QueryGridDataArgsSchema.parse(JSON.parse(rawArgs));
      const result = await queryGridData(tableId, userId, args);
      lastQueryResult = result;
      return { kind: 'result', content: JSON.stringify(result) };
    }

    if (name === 'getGridSummary') {
      const args = GetGridSummaryArgsSchema.parse(JSON.parse(rawArgs));
      void args;
      const result = await getGridSummary(tableId, userId);
      return { kind: 'result', content: JSON.stringify(result) };
    }

    if (name === 'updateCellsBatch') {
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
      return {
        kind: 'terminate',
        response: { pendingAction: { actionId, kind: 'updateCellsBatch', summary, updates: args.updates } },
      };
    }

    return { kind: 'result', content: `Unknown tool: ${name}` };
  };

  const { response, usage } = await runToolAgent<GridAgentTurnResponse>({
    systemPrompt: buildSystemPrompt(columns),
    history,
    message,
    tools: gridAgentTools,
    handleToolCall,
    buildFinalAnswer: (content) => ({
      answer: content,
      ...(lastQueryResult
        ? {
            evidence: {
              rows: lastQueryResult.rows.map((r) => ({ rowKey: r.rowKey, representativeLabel: r.representativeLabel })),
            },
          }
        : {}),
    }),
    buildCorrectionLimitAnswer: () => ({ answer: `I couldn't resolve a valid column for that request.` }),
    buildExhaustedAnswer: () => ({ answer: "I wasn't able to complete that — could you rephrase?" }),
  });

  return { ...response, usage };
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
