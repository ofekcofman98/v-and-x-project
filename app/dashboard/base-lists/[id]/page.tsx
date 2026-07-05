'use client';

/**
 * BaseList Details Page
 * Displays a specific BaseList with all its entities in a read-only grid.
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §3
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import type { BaseListWithEntities, BaseListSchema } from '@/lib/shared/types/models';
import { ColumnType } from '@/lib/shared/types/column-types';
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { NotFoundState } from '@/components/states/not-found-state';
import { ErrorState } from '@/components/states/error-state';
import { DetailPageHeader } from '@/components/shared/DetailPageHeader';
import type { StatCardConfig } from '@/components/shared/DetailPageHeader';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { useBaseListStore } from '@/lib/client/stores/base-list-store';
import { TableGridSection } from '@/components/shared-table/TableGridSection';
import type { ColumnDefinition, RowDefinition } from '@/lib/shared/types/table-schema';

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

export default function BaseListDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { toast } = useToast();
  const deleteList = useBaseListStore((s) => s.deleteList);

  const [baseList, setBaseList] = useState<BaseListWithEntitiesDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Memoized derived data — declared before early returns for stable hook order.
  // ---------------------------------------------------------------------------

  const schemaColumns = useMemo(
    () => ((baseList?.schema as BaseListSchema | undefined)?.columns ?? []),
    [baseList],
  );

  const entities = useMemo(() => baseList?.entities ?? [], [baseList]);

  /** Map BaseListSchema columns → ColumnDefinition[] (all are base columns). */
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

  /**
   * Derive the first TEXT column id to use as the entity display label,
   * mirroring the logic in the Table details page.
   */
  const firstTextColId = useMemo(
    () =>
      columns.find((col) => (col.type as string).toUpperCase() === 'TEXT')?.id ??
      columns[0]?.id,
    [columns],
  );

  /** Map entities → RowDefinition[] using values as the data source. */
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
      baseList
        ? [
            { title: 'Total Entities', value: entities.length.toString() },
            { title: 'Columns', value: columns.length.toString() },
            { title: 'Created', value: new Date(baseList.createdAt).toLocaleDateString() },
          ]
        : [],
    [baseList, entities.length, columns.length],
  );

  // ---------------------------------------------------------------------------

  const handleOpenDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);

  const handleDeleteConfirm = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/base-lists/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      deleteList(id);
      toast({ title: 'Base list deleted', description: `"${baseList?.name}" was removed successfully.` });
      router.push('/dashboard/base-lists');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const fetchBaseList = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const response = await fetch(`/api/base-lists/${id}`);

      if (response.status === 404) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch list' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch list`);
      }

      const result = await response.json();
      setBaseList(result.data);
      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseList();
  }, [id]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (notFound || !baseList) {
    return (
      <NotFoundState
        title="List Not Found"
        description="The list you're looking for doesn't exist or has been deleted."
        backLink="/dashboard/base-lists"
        backLabel="Back to Lists"
      />
    );
  }

  if (error) {
    return <ErrorState title="Failed to Load List" error={error} onRetry={fetchBaseList} />;
  }

  const hasData = entities.length > 0 && columns.length > 0;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="space-y-6">
            <DetailPageHeader
              name={baseList.name}
              description={baseList.description}
              backHref="/dashboard/base-lists"
              backLabel="Back to Lists"
              deleteAriaLabel="Delete base list"
              statCards={statCards}
              onDeleteClick={handleOpenDeleteDialog}
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
          </div>
        </section>
      </main>

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Base List"
        itemName={baseList.name}
        isDeleting={isDeleting}
      />
    </>
  );
}
