'use client';

/**
 * Create New Table Page
 * Full-screen dedicated route for table creation. Also the landing point for
 * a Schema Agent draft handed off from the tables list prompt bar (see
 * lib/client/utils/schema-agent-draft-storage.ts).
 * Implements: docs/logs/REFACTOR_TABLE_CREATOR.md, docs/features/03_ai_table_agent.md §3
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DynamicTableCreator } from '@/components/tables/DynamicTableCreator';
import { consumeSchemaAgentDraft } from '@/lib/client/utils/schema-agent-draft-storage';
import type { TableDraft } from '@/lib/shared/types/ai';

export default function NewTablePage() {
  const router = useRouter();
  const [initialDraft, setInitialDraft] = useState<TableDraft | undefined>(undefined);
  const [draftChecked, setDraftChecked] = useState(false);
  // consumeSchemaAgentDraft() is a destructive read (clears sessionStorage).
  // React Strict Mode double-invokes this effect on mount in dev; without
  // this guard the second invocation finds the key already cleared and
  // overwrites initialDraft back to undefined.
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;
    setInitialDraft(consumeSchemaAgentDraft() ?? undefined);
    setDraftChecked(true);
  }, []);

  // Wait for the sessionStorage check before mounting the creator, since
  // DynamicTableCreator only consumes `initialDraft` on its initial render.
  if (!draftChecked) return null;

  return (
    <DynamicTableCreator
      initialDraft={initialDraft}
      onClose={() => router.push('/dashboard/tables')}
      onSuccess={(tableId) => {
        router.push(`/dashboard/tables/${tableId}`);
      }}
    />
  );
}
