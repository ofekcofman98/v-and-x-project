'use client';

/**
 * Schema Agent container — owns the prompt → draft flow. On a successful
 * draft, hands it off to the dedicated `/dashboard/tables/new` route rather
 * than rendering the full-screen creator inline (which used to overlap the
 * tables list). Implements: docs/features/03_ai_table_agent.md §3.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SchemaAgentPromptBar } from './SchemaAgentPromptBar';
import { useSchemaAgentMutation } from '@/lib/client/hooks/use-schema-agent';
import { saveSchemaAgentDraft } from '@/lib/client/utils/schema-agent-draft-storage';
import type { SchemaAgentRequest } from '@/lib/shared/types/ai';

export function SchemaAgentSection() {
  const router = useRouter();
  const mutation = useSchemaAgentMutation();

  useEffect(() => {
    if (mutation.isSuccess) {
      saveSchemaAgentDraft(mutation.data.draft);
      router.push('/dashboard/tables/new');
    }
  }, [mutation.isSuccess, mutation.data, router]);

  function handleSubmit(request: SchemaAgentRequest) {
    mutation.mutate(request);
  }

  function handleRetry() {
    if (mutation.variables) {
      mutation.mutate(mutation.variables);
    }
  }

  return (
    <div className="mb-8">
      <SchemaAgentPromptBar
        onSubmit={handleSubmit}
        isLoading={mutation.isPending || mutation.isSuccess}
        error={mutation.isError ? mutation.error : null}
        onRetry={handleRetry}
      />
    </div>
  );
}
