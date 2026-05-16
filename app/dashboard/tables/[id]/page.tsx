'use client';

/**
 * Table Details Page
 * Displays a specific Table with its columns and cell data
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §3
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';

import { StatCard } from '@/components/shared/StatCard';
import { RelationCard } from '@/components/shared/RelationCard';
import { TableGridSection } from '@/components/table/TableGridSection';

import type { 
  TableWithRelations, 
  TableCell, 
  TableColumn, 
  ListEntity, 
  BaseListWithEntities,
  BaseListSchema 
} from '@/lib/types/models';
import { formatCellValue } from '@/lib/types/column-types';
import { prismaColumnTypeToColumnType } from '@/lib/types/models'; 
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { NotFoundState } from '@/components/states/not-found-state';
import { ErrorState } from '@/components/states/error-state';
import { EmptyEntitiesState } from '@/components/states/empty-state';
import { DataTable } from '@/components/table/DataTable';
import { useTableCellStore } from '@/lib/stores/table-cell-store';
import type { ColumnDefinition, RowDefinition } from '@/lib/types/table-schema';

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
    const id = params?.id as string;

    const [table, setTable] = useState<TableWithRelationsDTO | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    // Use the table cell store for cell data
    const fetchCells = useTableCellStore((state) => state.fetchCells);

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
    const baseListColumns = (baseList?.schema as BaseListSchema)?.columns || [];
    const tableColumns = table.columns || [];
    const cells = table.cells || [];

    const totalRows = entities.length;
    const totalDataColumns = tableColumns.length;
    const hasData = entities.length > 0 && (baseListColumns.length > 0 || tableColumns.length > 0);

    // Transform data for DataTable component
    const columns: ColumnDefinition[] = [
        ...baseListColumns.map((col) => ({
            id: col.id,
            label: col.label,
            type: col.type,
            isBaseColumn: true,
        })),
        ...tableColumns.map((col) => ({
            id: col.id,
            label: col.label,
            type: prismaColumnTypeToColumnType(col.type),
            isBaseColumn: false,
        })),
    ];

    const rows: RowDefinition[] = entities.map((entity) => ({
        id: entity.id,
        label: entity.values[baseListColumns[0]?.id]?.toString() || entity.id,
        values: entity.values,
    }));

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
        </>
    );
}



