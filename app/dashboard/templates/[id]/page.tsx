'use client';

/**
 * Template Details Page
 * Displays the full column schema and metadata for a single column template.
 * Implements: docs/features/02b_column_templates_ui.md §3.2
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { DetailPageHeader } from '@/components/shared/DetailPageHeader';
import type { StatCardConfig } from '@/components/shared/DetailPageHeader';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import type { ColumnTemplateDTO } from '@/lib/client/stores/column-template-store';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { NotFoundState } from '@/components/states/not-found-state';
import { ErrorState } from '@/components/states/error-state';
import { TemplateSchemaSection } from '@/components/templates/TemplateSchemaSection';
import { ApplyTemplateDialog } from '@/components/templates/ApplyTemplateDialog';
import { categoryIcon } from '@/components/templates/template-categories';

/** API response has dates serialised as ISO strings */
interface ColumnTemplateDetailsDTO extends Omit<ColumnTemplateDTO, 'created_at' | 'updated_at'> {
  user_id?: string;
  organization_id?: string | null;
  created_at: string;
  updated_at: string;
}

export default function TemplateDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [template, setTemplate] = useState<ColumnTemplateDetailsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [applyTarget, setApplyTarget] = useState<ColumnTemplateDTO | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Memoised derived data — declared before early returns for stable hook order.
  // ─────────────────────────────────────────────────────────────────────────

  const columns = useMemo(() => template?.schema?.columns ?? [], [template]);

  const statCards = useMemo<StatCardConfig[]>(() => {
    if (!template) return [];
    return [
      { title: 'Columns', value: columns.length.toString() },
      { title: 'Used by Lists', value: template.usage_count.toString() },
      { title: 'Category', value: template.category ? template.category.charAt(0).toUpperCase() + template.category.slice(1) : 'Custom' },
      { title: 'Created', value: new Date(template.created_at).toLocaleDateString() },
    ];
  }, [template, columns.length]);

  // ─────────────────────────────────────────────────────────────────────────

  const handleOpenDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);

  const handleDeleteConfirm = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/column-templates/${id}`, {
        method: 'DELETE',
        // TODO: Replace x-user-id with real auth header
        headers: { 'x-user-id': '00000000-0000-0000-0000-000000000000' },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.columnTemplates.all });
      toast({
        title: 'Template deleted',
        description: `"${template?.name}" was removed successfully.`,
      });
      router.push('/dashboard/templates');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const fetchTemplate = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const response = await fetch(`/api/column-templates/${id}`, {
        // TODO: Replace x-user-id with real auth header
        headers: { 'x-user-id': '00000000-0000-0000-0000-000000000000' },
      });

      if (response.status === 404) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch template' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch template`);
      }

      const result = await response.json() as { data: ColumnTemplateDetailsDTO };
      setTemplate(result.data);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ─────────────────────────────────────────────────────────────────────────
  // Early returns — after all hooks
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />;

  if (notFound || !template) {
    return (
      <NotFoundState
        title="Template Not Found"
        description="The template you're looking for doesn't exist or has been deleted."
        backLink="/dashboard/templates"
        backLabel="Back to Templates"
      />
    );
  }

  if (error) {
    return <ErrorState title="Failed to Load Template" error={error} onRetry={fetchTemplate} />;
  }

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="space-y-6">
            <DetailPageHeader
              name={`${categoryIcon(template.category)} ${template.name}`}
              description={template.description}
              backHref="/dashboard/templates"
              backLabel="Back to Templates"
              deleteAriaLabel="Delete template"
              statCards={statCards}
              onDeleteClick={handleOpenDeleteDialog}
            />

            <div className="flex justify-end">
              <Button onClick={() => setApplyTarget(template)}>
                <Zap className="h-4 w-4 mr-2" />
                Apply to Lists
              </Button>
            </div>

            <TemplateSchemaSection columns={columns} category={template.category} />
          </div>
        </section>
      </main>

      <ApplyTemplateDialog
        template={applyTarget}
        onClose={() => setApplyTarget(null)}
      />

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        itemName={template.name}
        isDeleting={isDeleting}
      />
    </>
  );
}
