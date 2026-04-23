'use client';

/**
 * Tables Dashboard Page - Display and manage all Tables
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §4
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTableStore } from '@/lib/stores/table-store';
import { useBaseListStore } from '@/lib/stores/base-list-store';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AppHeader } from '@/components/AppHeader';
import { CreateTableDialog } from '@/components/tables/create-table-dialog';
import { Plus, Table as TableIcon } from 'lucide-react';

/**
 * Loading skeleton for table cards
 */
function TableCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-full mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-28" />
      </CardFooter>
    </Card>
  );
}

/**
 * Empty state when no tables exist
 */
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="rounded-full bg-muted p-6 mb-4">
        <TableIcon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No tables yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        Create your first table to start collecting and organizing data. Tables are linked to base lists and contain custom data columns.
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="w-4 h-4 mr-2" />
        Create Your First Table
      </Button>
    </div>
  );
}

/**
 * Error state display
 */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
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
      <h3 className="text-lg font-semibold mb-2">Failed to load tables</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">{error}</p>
      <Button onClick={onRetry}>Try Again</Button>
    </div>
  );
}

export default function TablesDashboardPage() {
  const { tables, isLoading, error, fetchTables } = useTableStore();
  const { lists, fetchLists } = useBaseListStore();
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);

  useEffect(() => {
    fetchTables();
    fetchLists();
  }, [fetchTables, fetchLists]);

  // Helper to get base list name
  const getBaseListName = (baseListId: string) => {
    const baseList = lists.find((list) => list.id === baseListId);
    return baseList?.name || 'Unknown List';
  };

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Tables</h1>
                <p className="text-muted-foreground mt-2">
                  View and manage all your data tables
                </p>
              </div>
              <Button onClick={() => setIsCreateTableOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create New Table
              </Button>
            </div>
          </div>

          {error ? (
            <ErrorState error={error} onRetry={fetchTables} />
          ) : isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <TableCardSkeleton key={i} />
              ))}
            </div>
          ) : tables.length === 0 ? (
            <EmptyState onCreateClick={() => setIsCreateTableOpen(true)} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((table) => (
                <Card key={table.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-xl">{table.name}</CardTitle>
                    <CardDescription>
                      Base List: {getBaseListName(table.baseListId)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                          />
                        </svg>
                        <span>
                          {table.schema.columns.length} data column{table.schema.columns.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                          />
                        </svg>
                        <span className="truncate">
                          Rep. Column: {table.representativeColumnKey}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link
                      href={`/tables/${table.id}`}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
                    >
                      View Table
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      <CreateTableDialog
        open={isCreateTableOpen}
        onOpenChange={setIsCreateTableOpen}
      />
    </>
  );
}
