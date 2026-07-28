'use client';

/**
 * Create New Table Page
 * Full-screen dedicated route for table creation (live-canvas creator).
 * The AI-draft box lives inline inside DynamicTableCreator itself — no
 * sessionStorage handoff from the Tables dashboard anymore.
 * Implements: docs/logs/REFACTOR_TABLE_CREATOR.md, docs/features/13_ux_ia_redesign.md
 */

import { useRouter } from 'next/navigation';
import { DynamicTableCreator } from '@/components/tables/DynamicTableCreator';

export default function NewTablePage() {
  const router = useRouter();

  return (
    <DynamicTableCreator
      onClose={() => router.push('/dashboard/tables')}
      onSuccess={(tableId) => {
        router.push(`/dashboard/tables/${tableId}`);
      }}
    />
  );
}
