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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    const entities = baseList?.entities || [];
    const baseListColumns = (baseList?.schema as BaseListSchema)?.columns || [];
    const tableColumns = table.columns || [];
    const cells = table.cells || [];

    const totalRows = entities.length;
    const totalDataColumns = tableColumns.length;
    const hasData = entities.length > 0 && (baseListColumns.length > 0 || tableColumns.length > 0);

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
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Total Rows
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{totalRows}</div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Data Columns
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{totalDataColumns}</div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Created
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {new Date(table.createdAt).toLocaleDateString()}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {baseList && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Linked Base List</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Link
                                        href={`/dashboard/base-lists/${baseList.id}`}
                                        className="text-blue-600 hover:underline font-medium"
                                    >
                                        {baseList.name}
                                    </Link>
                                    {baseList.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {baseList.description}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Data Grid</CardTitle>
                                <CardDescription>
                                    Integrated view combining Base List entities and Table data columns
                                    {hasData && ` (${totalRows} ${totalRows === 1 ? 'row' : 'rows'})`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!hasData ? (
                                    <EmptyEntitiesState 
                                    title='No Data Yet'
                                    description="This table doesn't have any entities or columns yet. Add a Base List or create columns to get started."
                                    />
                                ) : (
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-muted">
                                                    <tr>
                                                        {baseListColumns.map((col) => (
                                                            <th
                                                                key={`base-${col.id}`}
                                                                className="px-4 py-3 text-left text-sm font-medium"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {col.label}
                                                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                                        Base
                                                                    </span>
                                                                </div>
                                                            </th>
                                                        ))}
                                                        {tableColumns.map((col) => (
                                                            <th
                                                                key={`table-${col.id}`}
                                                                className="px-4 py-3 text-left text-sm font-medium"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {col.label}
                                                                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                                                        Data
                                                                    </span>
                                                                </div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {entities.map((entity) => (
                                                        <tr key={entity.id} className="hover:bg-muted/50">
                                                            {baseListColumns.map((col) => {
                                                                const value = entity.values[col.id];
                                                                return (
                                                                    <td
                                                                        key={`${entity.id}-base-${col.id}`}
                                                                        className="px-4 py-3 text-sm"
                                                                    >
                                                                        {value !== null && value !== undefined
                                                                            ? formatCellValue(value, col.type)
                                                                            : '-'}
                                                                    </td>
                                                                );
                                                            })}
                                                            {tableColumns.map((col) => {
                                                                const cell = cells.find(
                                                                    (c) =>
                                                                        c.entityId === entity.id &&
                                                                        c.tableColumnId === col.id
                                                                );
                                                                const value = cell?.value?.value;
                                                                const columnType = prismaColumnTypeToColumnType(col.type);
                                                                return (
                                                                    <td
                                                                        key={`${entity.id}-table-${col.id}`}
                                                                        className="px-4 py-3 text-sm"
                                                                    >
                                                                        {value !== null && value !== undefined
                                                                            ? formatCellValue(value, columnType)
                                                                            : '-'}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </main>
        </>
    );
}



