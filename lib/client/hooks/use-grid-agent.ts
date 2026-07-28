/**
 * Grid Agent data hooks - TanStack Query wrappers around
 * POST /api/ai/grid-agent and POST /api/ai/grid-agent/execute.
 * Implements: docs/features/03_ai_table_agent.md §4.
 */

import { useMutation } from '@tanstack/react-query';
import type {
  GridAgentTurnRequest,
  GridAgentTurnResponse,
  GridAgentExecuteRequest,
  UpdateCellsBatchResult,
} from '@/lib/shared/types/ai';

export class GridAgentError extends Error {
  code: string;

  constructor(message: string, code = 'unknown') {
    super(message);
    this.name = 'GridAgentError';
    this.code = code;
  }
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    const errorList: string[] | undefined = result?.error;
    const message = errorList?.join(', ') || 'Grid Agent request failed';
    throw new GridAgentError(message, `http_${response.status}`);
  }

  return result.data as TResponse;
}

export function runGridAgentTurn(request: GridAgentTurnRequest): Promise<GridAgentTurnResponse> {
  return postJson<GridAgentTurnResponse>('/api/ai/grid-agent', request);
}

export function executeGridAgentAction(request: GridAgentExecuteRequest): Promise<UpdateCellsBatchResult> {
  return postJson<UpdateCellsBatchResult>('/api/ai/grid-agent/execute', request);
}

export function useGridAgentTurnMutation() {
  return useMutation<GridAgentTurnResponse, GridAgentError, GridAgentTurnRequest>({
    mutationFn: runGridAgentTurn,
  });
}

export function useGridAgentExecuteMutation() {
  return useMutation<UpdateCellsBatchResult, GridAgentError, GridAgentExecuteRequest>({
    mutationFn: executeGridAgentAction,
  });
}
