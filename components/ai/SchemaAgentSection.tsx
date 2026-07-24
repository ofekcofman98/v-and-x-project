'use client';

/**
 * Schema Agent container — owns the prompt → draft → preview/confirm flow.
 * Implements: docs/features/03_ai_table_agent.md §3
 */

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { DynamicTableCreator } from '@/components/tables/DynamicTableCreator';
import { SchemaAgentPromptBar } from './SchemaAgentPromptBar';
import { useSchemaAgentMutation } from '@/lib/client/hooks/use-schema-agent';
import { queryKeys } from '@/lib/query-keys';
import type { SchemaAgentRequest } from '@/lib/shared/types/ai';

export function SchemaAgentSection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useSchemaAgentMutation();

  function handleSubmit(request: SchemaAgentRequest) {
    mutation.mutate(request);
  }

  function handleRetry() {
    if (mutation.variables) {
      mutation.mutate(mutation.variables);
    }
  }

  function handleClosePreview() {
    mutation.reset();
  }

  function handleSuccess(tableId: string) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tables.all });
    router.push(`/dashboard/tables/${tableId}`);
  }

  return (
    <div className="mb-8">
      <SchemaAgentPromptBar
        onSubmit={handleSubmit}
        isLoading={mutation.isPending}
        error={mutation.isError ? mutation.error : null}
        onRetry={handleRetry}
      />

      {mutation.isSuccess && (
        <DynamicTableCreator
          initialDraft={mutation.data.draft}
          onClose={handleClosePreview}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
