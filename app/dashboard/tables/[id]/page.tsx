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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { TableWithRelations, TableColumnDTO, TableCellDTO } from '@/lib/types/models';

interface TableDTO {
  id: string;
  name: string;
  description: string | null;
  baseListId: string | null;
  representativeColumnKey: string;
  createdAt: string;
  updatedAt: string;
  columns: TableColumnDTO[];
  cells: TableCellDTO[];
}

function LoadingSkeleton() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-5 w-96" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>

            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}

function NotFoundState() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="rounded-full bg-red-50 p-6 mb-4">
              <svg
                className="h-12 w-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Table Not Found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              The table you're looking for doesn't exist or has been deleted.
            </p>
            <Link
              href="/dashboard/tables"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="rounded-full bg-red-50 p-6 mb-4">
              <svg
                className="h-12 w-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Failed to Load Table</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">{error}</p>
            <Button onClick={onRetry}>Try Again</Button>
          </div>
        </section>
      </main>
    </>
  );
}

function EmptyDataState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="rounded-full bg-muted p-6 mb-4">
        <svg
          className="h-12 w-12 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        This table doesn't have any data yet. Start adding data to populate the table.
      </p>
    </div>
  );
}

export default function TableDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [table, setTable] = useState<TableDTO | null>(null);
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

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (notFound) {
    return <NotFoundState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchTable} />;
  }

  if (!table) {
    return <NotFoundState />;
  }

  const columns = table.columns.sort((a, b) => a.order - b.order);
  const cells = table.cells;
  
  const rowKeys = Array.from(new Set(cells.map(cell => cell.rowKey))).sort();
  
  const getCellValue = (rowKey: string, columnId: string) => {
    const cell = cells.find(c => c.rowKey === rowKey && c.tableColumnId === columnId);
    return cell?.value ?? null;
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
                Back to Dashboard
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
                  <div className="text-2xl font-bold">{rowKeys.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Columns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{columns.length}</div>
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

            <Card>
              <CardHeader>
                <CardTitle>Table Data</CardTitle>
                <CardDescription>
                  All rows in this table ({rowKeys.length} total)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rowKeys.length === 0 ? (
                  <EmptyDataState />
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            {columns.map((col) => (
                              <th
                                key={col.id}
                                className="px-4 py-3 text-left text-sm font-medium"
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rowKeys.map((rowKey) => (
                            <tr key={rowKey} className="hover:bg-muted/50">
                              {columns.map((col) => {
                                const value = getCellValue(rowKey, col.id);
                                return (
                                  <td
                                    key={`${rowKey}-${col.id}`}
                                    className="px-4 py-3 text-sm"
                                  >
                                    {value !== null && value !== undefined
                                      ? String(value)
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
