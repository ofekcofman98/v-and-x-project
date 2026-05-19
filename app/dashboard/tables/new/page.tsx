'use client';

/**
 * Create New Table Page
 * Full-screen dedicated route for table creation
 * Implements: docs/logs/REFACTOR_TABLE_CREATOR.md
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
