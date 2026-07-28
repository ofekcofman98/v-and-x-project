'use client';

/**
 * Template Detail Pane
 * Prop-driven (no route coupling) rendering of a single Column Template.
 * Used inline by the Library page's master-detail layout, and reused by the
 * standalone /dashboard/templates/[id] route as a thin wrapper.
 * Implements: docs/features/13_ux_ia_redesign.md § Library Page › Detail pane — Templates tab
 */

import { useCallback, useMemo, useState } from 'react';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { DetailPageHeader } from '@/components/shared/DetailPageHeader';
import type { StatCardConfig } from '@/components/shared/DetailPageHeader';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { ApplyTemplateDialog } from '@/components/templates/ApplyTemplateDialog';
import { categoryIcon } from '@/components/templates/template-categories';
import { EditableTemplateSchemaTable } from '@/components/templates/EditableTemplateSchemaTable';
import type { EditableTemplateColumn } from '@/components/templates/EditableTemplateSchemaTable';
import type { ColumnTemplateDTO } from '@/lib/client/stores/column-template-store';
import {
  useColumnTemplateQuery,
  useDeleteColumnTemplateMutation,
  useUpdateColumnTemplateSchemaMutation,
} from '@/lib/client/hooks/data/use-column-templates';

export interface TemplateDetailPaneProps {
  id: string;
  /** Optional back link — pass only when rendered as a standalone page, not inline. */
  backHref?: string;
  backLabel?: string;
  /** Called after a successful delete so the caller can clear selection / navigate. */
  onDeleted?: () => void;
}

export function TemplateDetailPane({ id, backHref, backLabel, onDeleted }: TemplateDetailPaneProps) {
  const { toast } = useToast();
  const { data: template, isLoading, error, refetch } = useColumnTemplateQuery(id);
  const deleteMutation = useDeleteColumnTemplateMutation();
  const updateSchemaMutation = useUpdateColumnTemplateSchemaMutation();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [applyTarget, setApplyTarget] = useState<ColumnTemplateDTO | null>(null);

  const columns = useMemo(() => template?.schema?.columns ?? [], [template]);

  const statCards = useMemo<StatCardConfig[]>(() => {
    if (!template) return [];
    return [
      { title: 'Columns', value: columns.length.toString() },
      { title: 'Used by Lists', value: template.usage_count.toString() },
      {
        title: 'Category',
        value: template.category ? template.category.charAt(0).toUpperCase() + template.category.slice(1) : 'Custom',
      },
    ];
  }, [template, columns.length]);

  const handleOpenDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Template deleted', description: `"${template?.name}" was removed successfully.` });
      setDeleteDialogOpen(false);
      onDeleted?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSchemaSave = async (nextColumns: EditableTemplateColumn[]) => {
    try {
      await updateSchemaMutation.mutateAsync({ id, schema: { columns: nextColumns } });
      toast({ title: 'Template updated', description: 'Column schema saved.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <InlineErrorState
        error={error instanceof Error ? error.message : 'Template not found'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <DetailPageHeader
        name={`${categoryIcon(template.category)} ${template.name}`}
        description={template.description}
        backHref={backHref}
        backLabel={backLabel}
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

      <EditableTemplateSchemaTable
        // API constrains `type` to the same 4 literals server-side (see TemplateColumnSchema in app/api/column-templates/[id]/route.ts)
        columns={columns as EditableTemplateColumn[]}
        onSave={handleSchemaSave}
        isSaving={updateSchemaMutation.isPending}
      />

      <ApplyTemplateDialog template={applyTarget} onClose={() => setApplyTarget(null)} />

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        itemName={template.name}
        isDeleting={isDeleting}
      />
    </div>
  );
}
