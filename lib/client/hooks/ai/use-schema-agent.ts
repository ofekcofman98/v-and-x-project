/**
 * Schema Agent data hook - TanStack Query wrapper around POST /api/ai/schema-agent
 * Implements: docs/features/03_ai_table_agent.md §3.4
 */

import { useMutation } from '@tanstack/react-query';
import type { SchemaAgentRequest, SchemaAgentResponse } from '@/lib/shared/types/ai';

export class SchemaAgentError extends Error {
  code: string;

  constructor(message: string, code = 'unknown') {
    super(message);
    this.name = 'SchemaAgentError';
    this.code = code;
  }
}

async function generateTableDraft(request: SchemaAgentRequest): Promise<SchemaAgentResponse> {
  const response = await fetch('/api/ai/schema-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    const errorList: string[] | undefined = result?.error;
    const message = errorList?.join(', ') || 'Failed to draft table';
    throw new SchemaAgentError(message, `http_${response.status}`);
  }

  return result.data as SchemaAgentResponse;
}

export function useSchemaAgentMutation() {
  return useMutation<SchemaAgentResponse, SchemaAgentError, SchemaAgentRequest>({
    mutationFn: generateTableDraft,
  });
}
