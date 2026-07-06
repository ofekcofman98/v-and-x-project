'use client';

/**
 * Create New Template Page
 * Full-screen dedicated route for template creation.
 * Mirrors: app/dashboard/tables/new/page.tsx
 */

import { useRouter } from 'next/navigation';
import { DynamicTemplateCreator } from '@/components/column-templates/DynamicTemplateCreator';

export default function NewTemplatePage() {
  const router = useRouter();

  return (
    <DynamicTemplateCreator
      open={true}
      onClose={() => router.push('/dashboard/templates')}
      onSuccess={() => router.push('/dashboard/templates')}
      allowRows={false}
      allowDataEntry={false}
    />
  );
}
