'use client';

/**
 * BaseList Details Page — thin route wrapper.
 * The actual detail rendering lives in BaseListDetailPane, which is reused
 * inline by the Library page's master-detail layout (no route coupling there).
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §3, docs/features/13_ux_ia_redesign.md
 */

import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BaseListDetailPane } from '@/components/base-lists/BaseListDetailPane';

export default function BaseListDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <BaseListDetailPane
            id={id}
            backHref="/dashboard/library"
            backLabel="Back to Library"
            onDeleted={() => router.push('/dashboard/library')}
          />
        </section>
      </main>
    </>
  );
}
