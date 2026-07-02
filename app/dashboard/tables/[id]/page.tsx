'use client';

/**
 * Table Details Page
 * Displays a specific Table with its columns and cell data
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §3
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { useTableStore } from '@/lib/client/stores/table-store';
import { Trash2 } from 'lucide-react';

import { StatCard } from '@/components/shared/StatCard';
import { RelationCard } from '@/components/shared/RelationCard';
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
import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
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

    // Use the table cell store for cell data
    const fetchCells = useTableCellStore((state) => state.fetchCells);

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

    // Fetch cell data using the store
    useEffect(() => {
        if (id) {
            fetchCells(id);
        }
    }, [id, fetchCells]);

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
    const entities = baseList?.entities || [];

    // Build a set of column IDs that originate from the BaseList schema.
    // This is used to mark which merged columns should read their cell values
    // from entity.values (isBaseColumn: true) vs. TableCell records (false).
    const baseListSchemaColumnIds = new Set(
        ((baseList?.schema as BaseListSchema)?.columns ?? []).map((c) => c.id)
    );

    // table.schema.columns (JSONB) is the single source of truth for the grid layout.
    // For tables created via apply-template it holds the complete merged schema
    // (identity + template columns). Only fall back to the legacy path of combining
    // baseList.schema + relational table.columns for pre-existing tables where the
    // JSON schema is empty — this preserves backward compatibility.
    const tableSchemaColumns = table.schema?.columns ?? [];
    const relationalTableColumns = table.columns || [];

    const columns: ColumnDefinition[] =
        tableSchemaColumns.length > 0
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

    const totalRows = entities.length;
    const totalDataColumns = columns.length;
    const hasData = entities.length > 0 && columns.length > 0;

    // Resolve entity display labels. Only search within base columns because
    // entity.values exclusively holds data for base-list-originated columns.
    const repColId = table.representativeColumnKey;
    const firstTextBaseColId =
        columns.find((col) => col.isBaseColumn && (col.type as string).toUpperCase() === 'TEXT')?.id ??
        columns.find((col) => col.isBaseColumn)?.id;

    const rows: RowDefinition[] = entities.map((entity) => ({
        id: entity.id,
        label:
            (entity.values[repColId] ?? entity.values[firstTextBaseColId ?? ''])?.toString() ||
            entity.id,
        values: entity.values,
    }));

    // Construct TableSchema for VoiceButton
    const tableSchema: TableSchema = {
        columns,
        rows,
    };

    return (
      <>
        <AppHeader />
        <main className="flex flex-1 flex-col">
          <section className="container py-8 md:py-12">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{table.name}</h1>
                  
                  {table.description && (
                    <p className="text-muted-foreground mt-2">{table.description}</p>
                  )}
                </div>
                            
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  aria-label="Delete table"
                  className="inline-flex items-center justify-center rounded-md h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link
                  href="/dashboard/tables"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-transparent hover:bg-gray-100 h-10 px-4 py-2"
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  
                  Back to Tables
                </Link>
              </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard title="Total Rows" value={totalRows.toString()} />
                  <StatCard title="Data Columns" value={totalDataColumns.toString()} />
                  <StatCard title="Created" value={new Date(table.createdAt).toLocaleDateString()} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {baseList && ( 
                  <RelationCard 
                    title="Linked Base List"
                    linkHref={`/dashboard/base-lists/${baseList.id}`}
                    linkLabel={baseList.name}
                    description={baseList.description}
                  />
                )}
              </div>
                <TableGridSection
                    tableId={id}
                    columns={columns}
                    rows={rows}
                    hasData={hasData}
                    totalRows={totalRows}
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



