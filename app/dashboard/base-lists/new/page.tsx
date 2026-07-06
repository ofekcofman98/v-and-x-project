'use client';

/**
 * Create New Base List Page
 * Full-screen dedicated route for base list creation.
 * Mirrors: app/dashboard/tables/new/page.tsx
 */

import { useRouter } from 'next/navigation';
import { DynamicListCreator } from '@/components/base-lists/DynamicListCreator';

export default function NewBaseListPage() {
  const router = useRouter();

  return (
    <DynamicListCreator
      open={true}
      onClose={() => router.push('/dashboard/base-lists')}
      onSuccess={() => router.push('/dashboard/base-lists')}
      allowRows={true}
      allowDataEntry={true}
    />
  );
}
