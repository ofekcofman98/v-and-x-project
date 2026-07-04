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
import { useToast } from '@/components/ui/use-toast';
import { useTableStore } from '@/lib/client/stores/table-store';

import { TableGridSection } from '@/components/shared-table/TableGridSection';

import type { 
  TableWithRelations, 
  TableCell, 
  TableColumn, 
  ListEntity, 
  BaseListWithEntities,
  BaseListSchema 
} from '@/lib/shared/types/models';
import { ColumnType } from '@/lib/shared/types/column-types';
import { prismaColumnTypeToColumnType } from '@/lib/shared/types/models'; 
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { NotFoundState } from '@/components/states/not-found-state';
import { ErrorState } from '@/components/states/error-state';
import type { ColumnDefinition, RowDefinition, TableSchema } from '@/lib/shared/types/table-schema';
import { VoiceButton } from '@/components/voice/VoiceButton';

interface ListEntityDTO extends Omit<ListEntity, 'createdAt' | 'updatedAt'> {
    createdAt: string;
    updatedAt: string;
}

interface BaseListWithEntitiesDTO extends Omit<BaseListWithEntities, 'createdAt' | 'updatedAt' | 'entities'> {
    createdAt: string;
    updatedAt: string;
    entities: ListEntityDTO[];
}

interface TableCellDTO extends Omit<TableCell, 'createdAt' | 'updatedAt'> {
    createdAt: string;
    updatedAt: string;
}

interface TableColumnDTO extends Omit<TableColumn, 'createdAt' | 'updatedAt'> {
    createdAt: string;
    updatedAt: string;
}

interface TableWithRelationsDTO extends Omit<TableWithRelations, 'createdAt' | 'updatedAt' | 'columns' | 'cells' | 'baseList'> {
    createdAt: string;
    updatedAt: string;
    columns: TableColumnDTO[];
    cells?: TableCellDTO[];
    baseList?: BaseListWithEntitiesDTO | null;
}

      

export default function TableDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const { toast } = useToast();
    const deleteTable = useTableStore((s) => s.deleteTable);

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

    // table.schema.columns (JSONB) is the single source of truth for the grid layout.
    // For tables created via apply-template it holds the complete merged schema
    // (identity + template columns). Only fall back to the legacy path of combining
    // baseList.schema + relational table.columns for pre-existing tables where the
    // JSON schema is empty — this preserves backward compatibility.
    const columns = useMemo<ColumnDefinition[]>(() => {
        if (!table) return [];
        const baseList = table.baseList;
        const baseListSchemaColumnIds = new Set(
            ((baseList?.schema as BaseListSchema)?.columns ?? []).map((c) => c.id)
        );
        const tableSchemaColumns = table.schema?.columns ?? [];
        const relationalTableColumns = table.columns ?? [];

        return tableSchemaColumns.length > 0
            ? tableSchemaColumns.map((col) => ({
                  id: col.id,
                  label: col.label,
                  type: col.type as unknown as ColumnType,
                  isBaseColumn: baseListSchemaColumnIds.has(col.id),
              }))
            : [
                  ...((baseList?.schema as BaseListSchema)?.columns ?? []).map((col) => ({
                      id: col.id,
                      label: col.label,
                      type: (col.type as string).toUpperCase() as ColumnType,
                      isBaseColumn: true as const,
                  })),
                  ...relationalTableColumns.map((col) => ({
                      id: col.id,
                      label: col.label,
                      type: prismaColumnTypeToColumnType(col.type),
                      isBaseColumn: false as const,
                  })),
              ];
    }, [table]);

    const rows = useMemo<RowDefinition[]>(() => {
        if (!table) return [];
        const entities = table.baseList?.entities ?? [];
        const repColId = table.representativeColumnKey;
        // Resolve entity display labels. Only search within base columns because
        // entity.values exclusively holds data for base-list-originated columns.
        const firstTextBaseColId =
            columns.find((col) => col.isBaseColumn && (col.type as string).toUpperCase() === 'TEXT')?.id ??
            columns.find((col) => col.isBaseColumn)?.id;

        return entities.map((entity) => ({
            id: entity.id,
            label:
                (entity.values[repColId] ?? entity.values[firstTextBaseColId ?? ''])?.toString() ||
                entity.id,
            values: entity.values,
        }));
    }, [table, columns]);

    // Stable reference for VoiceButton — only recreated when columns/rows change.
    const tableSchema = useMemo<TableSchema>(() => ({ columns, rows }), [columns, rows]);

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
            deleteTable(id);
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
          <section className="container py-8 md:py-12">
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

          {/* Voice Input Button - Fixed Position */}
          {hasData && (
            <div className="fixed bottom-8 right-8 z-50">
              <VoiceButton tableId={id} tableSchema={tableSchema} />
            </div>
          )}

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



