'use client';

/**
 * Tables Dashboard Page - Display and manage all Tables
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §4
 */

import { useState } from 'react';
import Link from 'next/link';
import { useTablesQuery, useDeleteTableMutation } from '@/lib/client/hooks/data/use-tables';
import { useBaseListsQuery } from '@/lib/client/hooks/data/use-base-lists';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AppHeader } from '@/components/AppHeader';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { InlineErrorState } from '@/components/states/error-state';
import { useToast } from '@/components/ui/use-toast';
import { SchemaAgentSection } from '@/components/ai/SchemaAgentSection';
import { Plus, Table as TableIcon, Trash2 } from 'lucide-react';

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
      <Link href="/dashboard/tables/new">
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Your First Table
        </Button>
      </Link>
    </div>
  );
}

export default function TablesDashboardPage() {
  const { data: tables = [], isLoading, error, refetch } = useTablesQuery();
  const { data: lists = [] } = useBaseListsQuery();
  const deleteTableMutation = useDeleteTableMutation();
  const { toast } = useToast();

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const getBaseListName = (baseListId: string) => {
    const baseList = lists.find((list) => list.id === baseListId);
    return baseList?.name || 'Unknown List';
  };

  const pendingTable = tables.find((t) => t.id === pendingDeleteId);

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteTableMutation.mutateAsync(pendingDeleteId);
      toast({ title: 'Table deleted', description: `"${pendingTable?.name}" was removed successfully.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
    } finally {
      setPendingDeleteId(null);
    }
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
              <Link href="/dashboard/tables/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Table
                </Button>
              </Link>
            </div>
          </div>

          <SchemaAgentSection />

          {error ? (
            <InlineErrorState error={error.message} onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <TableCardSkeleton key={i} />
              ))}
            </div>
          ) : tables.length === 0 ? (
            <EmptyState onCreateClick={() => {}} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((table) => (
                <Card key={table.id} className="group flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl">{table.name}</CardTitle>
                      <button
                        onClick={() => setPendingDeleteId(table.id)}
                        aria-label={`Delete ${table.name}`}
                        className="mt-0.5 shrink-0 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <CardDescription>
                      Base List: {getBaseListName(table.baseListId || '')}
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
                      href={`/dashboard/tables/${table.id}`}
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

      <DeleteConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Table"
        itemName={pendingTable?.name || ''}
        isDeleting={deleteTableMutation.isPending}
      />
    </>
  );
}
