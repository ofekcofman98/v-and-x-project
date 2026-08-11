'use client';

/**
 * Table Details Page
 * Displays a specific Table with its columns and cell data
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §3
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { DetailPageHeader } from '@/components/shared/DetailPageHeader';
import type { StatCardConfig } from '@/components/shared/DetailPageHeader';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { TableGridSection } from '@/components/shared-table/TableGridSection';
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { NotFoundState } from '@/components/states/not-found-state';
import { ErrorState } from '@/components/states/error-state';
import { GridChatButton } from '@/components/ai/GridChatButton';
import { GridChatPanel } from '@/components/ai/GridChatPanel';
import {
  deriveTableColumns,
  deriveTableRows,
  type TableWithRelationsDTO,
} from '@/lib/shared/utils/table-schema-derivation';



export default function TableDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [table, setTable] = useState<TableWithRelationsDTO | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // -------------------------------------------------------------------------
    // Memoized derived data — must be declared before early returns so that
    // hook call order is stable across renders. Guards against null table.
    // -------------------------------------------------------------------------

    // See lib/shared/utils/table-schema-derivation.ts for the derivation rules
    // (JSONB table.schema.columns as source of truth, legacy fallback below it).
    const columns = useMemo(() => deriveTableColumns(table), [table]);
    const rows = useMemo(() => deriveTableRows(table, columns), [table, columns]);

    // Stable stat card descriptors — only recreated when the counts or date change.
    const statCards = useMemo<StatCardConfig[]>(() => {
        if (!table) return [];
        const entities = table.baseList?.entities ?? [];
        return [
            { title: 'Total Rows', value: entities.length.toString() },
            { title: 'Data Columns', value: columns.length.toString() },
            { title: 'Created', value: new Date(table.createdAt).toLocaleDateString() },
        ];
    }, [table, columns]);

    // -------------------------------------------------------------------------

    const handleOpenDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);

    const handleDeleteConfirm = async () => {
        if (!id) return;
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/tables/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const data = await response.json().catch(() => ({ error: 'Delete failed' }));
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.tables.all });
            toast({ title: 'Table deleted', description: `"${table?.name}" was removed successfully.` });
            router.push('/dashboard/tables');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Something went wrong';
            toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
            setIsDeleting(false);
            setDeleteDialogOpen(false);
        }
    };

    const fetchTable = async () => {
        if (!id) return;

        setIsLoading(true);
        setError(null);
        setNotFound(false);

        try {
            const response = await fetch(`/api/tables/${id}`);

            if (response.status === 404) {
                setNotFound(true);
                setIsLoading(false);
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fetch table' }));
                throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch table`);
            }

            const result = await response.json();
            setTable(result.data);
            setIsLoading(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            setError(errorMessage);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTable();
    }, [id]);

    if (isLoading){
        return <LoadingSkeleton />;
    }

    if (notFound || !table) {
        return <NotFoundState 
        title='Table Not Found'
        description="The table you're looking for doesn't exist or has been deleted."
        backLink='/dashboard/tables'
        backLabel='Back to Tables'
        />;
    }

    if (error) {
        return <ErrorState
        title='Failed to Load Table'
        error={error} 
        onRetry={fetchTable} 
        />;
    }

    const baseList = table.baseList;
    const entities = baseList?.entities ?? [];
    const hasData = entities.length > 0 && columns.length > 0;

    return (
      <>
        <AppHeader />
        <main className="flex flex-1 flex-col">
          <section className="container py-8 md:py-12 pb-12">
            <div className="space-y-6">
              <DetailPageHeader
                name={table.name}
                description={table.description}
                backHref="/dashboard/tables"
                backLabel="Back to Tables"
                deleteAriaLabel="Delete table"
                statCards={statCards}
                onDeleteClick={handleOpenDeleteDialog}
                relationCard={
                  baseList
                    ? {
                        title: 'Linked Base List',
                        linkHref: `/dashboard/base-lists/${baseList.id}`,
                        linkLabel: baseList.name,
                        description: baseList.description,
                      }
                    : null
                }
              />
              {hasData && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/api/tables/${id}/export?format=csv`, '_blank')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              )}
                <TableGridSection
                    tableId={id}
                    columns={columns}
                    rows={rows}
                    hasData={hasData}
                    totalRows={entities.length}
                />
              </div>
            </section>
          </main>

          {/* Grid Chat Button - Fixed Position */}
          {hasData && (
            <div className="fixed bottom-8 left-8 z-50">
              <GridChatButton tableId={id} />
            </div>
          )}
          <GridChatPanel tableId={id} />

          <DeleteConfirmDialog
            isOpen={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Delete Table"
            itemName={table?.name || ''}
            isDeleting={isDeleting}
          />
        </>
    );
}



