'use client';

/**
 * Dashboard Page - Display and manage BaseLists
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §1
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBaseListStore } from '@/lib/stores/base-list-store';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AppHeader } from '@/components/AppHeader';
import { CreateListWizard } from '@/components/base-lists/create-list-wizard';

/**
 * Loading skeleton for list cards
 */
function ListCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-full mt-2" />
      </CardHeader>
      <CardFooter>
        <Skeleton className="h-10 w-28" />
      </CardFooter>
    </Card>
  );
}

/**
 * Empty state when no lists exist
 */
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
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
      <h3 className="text-lg font-semibold mb-2">No lists yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        Get started by creating your first base list. Base lists define the entities you want to track across multiple tables.
      </p>
      <Button onClick={onCreateClick}>
        Create Your First List
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
      <h3 className="text-lg font-semibold mb-2">Failed to load lists</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">{error}</p>
      <Button onClick={onRetry}>Try Again</Button>
    </div>
  );
}

export default function DashboardPage() {
  const { lists, isLoading, error, fetchLists } = useBaseListStore();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Base Lists</h1>
                <p className="text-muted-foreground mt-2">
                  Manage your entity lists and track data across tables
                </p>
              </div>
              <Button onClick={() => setIsWizardOpen(true)}>
                Create New List
              </Button>
            </div>
          </div>

          {error ? (
            <ErrorState error={error} onRetry={fetchLists} />
          ) : isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <ListCardSkeleton key={i} />
              ))}
            </div>
          ) : lists.length === 0 ? (
            <EmptyState onCreateClick={() => setIsWizardOpen(true)} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((list) => (
                <Card key={list.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-xl">{list.name}</CardTitle>
                    {list.description && (
                      <CardDescription className="line-clamp-2">
                        {list.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="text-sm text-muted-foreground">
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
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>
                          {list.schema.columns.length} column{list.schema.columns.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link
                      href={`/lists/${list.id}`}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-transparent hover:bg-gray-100 h-10 px-4 py-2 w-full"
                    >
                      View List
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      <CreateListWizard
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </>
  );
}
