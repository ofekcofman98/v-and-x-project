'use client';

/**
 * Create New Base List Page
 * Full-screen dedicated route for base list creation.
 * Mirrors: app/dashboard/tables/new/page.tsx
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { DynamicListCreator } from '@/components/base-lists/DynamicListCreator';
import { useCsvImportStore } from '@/lib/client/stores/csv-import-store';

export default function NewBaseListPage() {
  const router = useRouter();

  // Snapshot the pending CSV import (if any) exactly once on mount, so a
  // manual revisit of this route later doesn't reuse stale data. Cleared in
  // an effect (not during render) once the snapshot is taken.
  const pendingRef = useRef(useCsvImportStore.getState().pending);
  const clearPending = useCsvImportStore((s) => s.clearPending);
  useEffect(() => {
    if (pendingRef.current) clearPending();
  }, [clearPending]);

  const pending = pendingRef.current;

  return (
    <DynamicListCreator
      open={true}
      onClose={() => router.push('/dashboard/base-lists')}
      onSuccess={() => router.push('/dashboard/base-lists')}
      allowRows={true}
      allowDataEntry={true}
      initialName={pending?.name}
      initialColumns={pending?.columns}
      initialRows={pending?.rows}
    />
  );
}
