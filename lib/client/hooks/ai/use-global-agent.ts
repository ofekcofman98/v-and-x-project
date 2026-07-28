/**
 * Global Agent data hooks - TanStack Query wrappers around
 * POST /api/ai/global-agent and POST /api/ai/global-agent/execute.
 * Mirrors use-grid-agent.ts.
 */

import { useMutation } from '@tanstack/react-query';
import type {
  GlobalAgentTurnRequest,
  GlobalAgentTurnResponse,
  GlobalAgentExecuteRequest,
  UpdateCellsBatchResult,
} from '@/lib/shared/types/ai';

export class GlobalAgentError extends Error {
  code: string;

  constructor(message: string, code = 'unknown') {
    super(message);
    this.name = 'GlobalAgentError';
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
    const message = errorList?.join(', ') || 'Global Agent request failed';
    throw new GlobalAgentError(message, `http_${response.status}`);
  }

  return result.data as TResponse;
}

export function runGlobalAgentTurn(request: GlobalAgentTurnRequest): Promise<GlobalAgentTurnResponse> {
  return postJson<GlobalAgentTurnResponse>('/api/ai/global-agent', request);
}

export function executeGlobalAgentAction(request: GlobalAgentExecuteRequest): Promise<UpdateCellsBatchResult> {
  return postJson<UpdateCellsBatchResult>('/api/ai/global-agent/execute', request);
}

export function useGlobalAgentTurnMutation() {
  return useMutation<GlobalAgentTurnResponse, GlobalAgentError, GlobalAgentTurnRequest>({
    mutationFn: runGlobalAgentTurn,
  });
}

export function useGlobalAgentExecuteMutation() {
  return useMutation<UpdateCellsBatchResult, GlobalAgentError, GlobalAgentExecuteRequest>({
    mutationFn: executeGlobalAgentAction,
  });
}
