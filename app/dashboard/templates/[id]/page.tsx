'use client';

/**
 * Template Details Page — thin route wrapper.
 * The actual detail rendering lives in TemplateDetailPane, which is reused
 * inline by the Library page's master-detail layout (no route coupling there).
 * Implements: docs/features/02b_column_templates_ui.md §3.2, docs/features/13_ux_ia_redesign.md
 */

import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { TemplateDetailPane } from '@/components/templates/TemplateDetailPane';

export default function TemplateDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <TemplateDetailPane
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
