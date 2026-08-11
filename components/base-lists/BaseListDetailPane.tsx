'use client';

/**
 * BaseList Detail Pane
 * Prop-driven (no route coupling) rendering of a single BaseList's entities.
 * Used inline by the Library page's master-detail layout, and reused by the
 * standalone /dashboard/base-lists/[id] route as a thin wrapper.
 * Implements: docs/features/13_ux_ia_redesign.md § Library Page
 */

import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { BaseListWithEntities, BaseListSchema } from '@/lib/shared/types/models';
import { ColumnType } from '@/lib/shared/types/column-types';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { DetailPageHeader } from '@/components/shared/DetailPageHeader';
import type { StatCardConfig, HeaderMenuAction } from '@/components/shared/DetailPageHeader';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { TableGridSection } from '@/components/shared-table/TableGridSection';
import type { ColumnDefinition, RowDefinition } from '@/lib/shared/types/table-schema';
import { useBaseListQuery, useDeleteBaseListMutation } from '@/lib/client/hooks/data/use-base-lists';
import { MoveListDialog } from '@/components/library/MoveListDialog';
import { MoveRight, LayoutGrid } from 'lucide-react';

interface ListEntityDTO {
  id: string;
  baseListId: string;
  values: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

interface BaseListWithEntitiesDTO extends Omit<BaseListWithEntities, 'createdAt' | 'updatedAt' | 'entities'> {
  createdAt: string;
  updatedAt: string;
  entities: ListEntityDTO[];
}

/**
 * Scoped dark-navy theme for this pane only — overrides the same CSS custom
 * properties app/globals.css's `.dark` class sets (consumed by Card,
 * DetailPageHeader, StatCard, etc. via `hsl(var(--color-*))` in
 * tailwind.config.ts), so every token-based child repaints automatically
 * without touching the global light/dark theme. `as CSSProperties` is
 * required because custom properties aren't part of the CSS typings.
 */
const darkPanelStyle = {
  '--color-background': '222 47% 11%',
  '--color-foreground': '210 40% 98%',
  '--color-card': '222 39% 15%',
  '--color-card-foreground': '210 40% 98%',
  '--color-popover': '222 39% 15%',
  '--color-popover-foreground': '210 40% 98%',
  '--color-muted': '217 33% 20%',
  '--color-muted-foreground': '215 20% 65%',
  '--color-accent': '217 33% 20%',
  '--color-accent-foreground': '210 40% 98%',
  '--color-border': '217 33% 24%',
  '--color-input': '217 33% 24%',
} as CSSProperties;

export interface BaseListDetailPaneProps {
  id: string;
  /** Optional back link — pass only when rendered as a standalone page, not inline. */
  backHref?: string;
  backLabel?: string;
  /** Called after a successful delete so the caller can clear selection / navigate. */
  onDeleted?: () => void;
}

export function BaseListDetailPane({ id, backHref, backLabel, onDeleted }: BaseListDetailPaneProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { data: baseList, isLoading, error, refetch } = useBaseListQuery(id);
  const deleteMutation = useDeleteBaseListMutation();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showMove, setShowMove] = useState(false);

  const typedBaseList = baseList as BaseListWithEntitiesDTO | undefined;

  const schemaColumns = useMemo(
    () => ((typedBaseList?.schema as BaseListSchema | undefined)?.columns ?? []),
    [typedBaseList],
  );

  const entities = useMemo(() => typedBaseList?.entities ?? [], [typedBaseList]);

  const columns = useMemo<ColumnDefinition[]>(
    () =>
      schemaColumns.map((col) => ({
        id: col.id,
        label: col.label,
        type: col.type as unknown as ColumnType,
        isBaseColumn: true as const,
      })),
    [schemaColumns],
  );

  const firstTextColId = useMemo(
    () =>
      columns.find((col) => (col.type as string).toUpperCase() === 'TEXT')?.id ??
      columns[0]?.id,
    [columns],
  );

  const rows = useMemo<RowDefinition[]>(
    () =>
      entities.map((entity) => ({
        id: entity.id,
        label: entity.values[firstTextColId ?? '']?.toString() || entity.id,
        values: entity.values,
      })),
    [entities, firstTextColId],
  );

  const statCards = useMemo<StatCardConfig[]>(
    () =>
      typedBaseList
        ? [
            { title: 'Total Entities', value: entities.length.toString() },
            { title: 'Columns', value: columns.length.toString() },
            { title: 'Created', value: new Date(typedBaseList.createdAt).toLocaleDateString() },
          ]
        : [],
    [typedBaseList, entities.length, columns.length],
  );

  const handleOpenDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);

  const moreActions = useMemo<HeaderMenuAction[]>(
    () => [
      {
        label: 'Open in Workspace',
        icon: <LayoutGrid className="h-4 w-4" />,
        onClick: () => router.push(`/dashboard/workspace?list=${id}`),
      },
      { label: 'Move to Group/Workbench…', icon: <MoveRight className="h-4 w-4" />, onClick: () => setShowMove(true) },
    ],
    [router, id],
  );

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Base list deleted', description: `"${typedBaseList?.name}" was removed successfully.` });
      setDeleteDialogOpen(false);
      onDeleted?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={darkPanelStyle} className="space-y-6 bg-background text-foreground rounded-xl border border-border p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !typedBaseList) {
    return (
      <div style={darkPanelStyle} className="bg-background text-foreground rounded-xl border border-border p-6">
        <InlineErrorState
          error={error instanceof Error ? error.message : 'List not found'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const hasData = entities.length > 0 && columns.length > 0;

  return (
    <div style={darkPanelStyle} className="space-y-6 bg-background text-foreground rounded-xl border border-border p-6">
      <DetailPageHeader
        name={typedBaseList.name}
        description={typedBaseList.description}
        backHref={backHref}
        backLabel={backLabel}
        deleteAriaLabel="Delete base list"
        statCards={statCards}
        onDeleteClick={handleOpenDeleteDialog}
        moreActions={moreActions}
      />

      <TableGridSection
        columns={columns}
        rows={rows}
        hasData={hasData}
        totalRows={entities.length}
        title="Entities"
        description={`All entities in this list${hasData ? ` (${entities.length} ${entities.length === 1 ? 'entity' : 'entities'})` : ''}`}
        isReadOnly
      />

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Base List"
        itemName={typedBaseList.name}
        isDeleting={isDeleting}
      />

      <MoveListDialog
        baseListId={id}
        baseListName={typedBaseList.name}
        open={showMove}
        onClose={() => setShowMove(false)}
      />
    </div>
  );
}
