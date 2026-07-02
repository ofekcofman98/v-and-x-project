'use client';

/**
 * BaseList Details Page
 * Displays a specific BaseList with all its entities in a dynamic table
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §3
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { BaseListWithEntities, BaseListSchema, ListEntity } from '@/lib/shared/types/models';
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { NotFoundState } from '@/components/states/not-found-state';
import { ErrorState } from '@/components/states/error-state';
import { EmptyEntitiesState } from '@/components/states/empty-state';
import { StatCard } from '@/components/shared/StatCard';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { useBaseListStore } from '@/lib/client/stores/base-list-store';
import { Trash2 } from 'lucide-react';

interface ListEntityDTO extends Omit<ListEntity, 'createdAt' | 'updatedAt'> {
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
    return <NotFoundState 
    title='List Not Found'
    description="The list you're looking for doesn't exist or has been deleted."
    backLink='/dashboard/base-lists'
    backLabel='Back to Lists'
    />;
  }

  if (error) {
    return <ErrorState 
    title='Failed to Load List'
    error={error} 
    onRetry={fetchBaseList} 
    />;
  }

  const schema = baseList.schema as BaseListSchema;
  const columns = schema.columns;
  const entities = baseList.entities;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{baseList.name}</h1>
                {baseList.description && (
                  <p className="text-muted-foreground mt-2">{baseList.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  aria-label="Delete base list"
                  className="inline-flex items-center justify-center rounded-md h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link
                  href="/dashboard/base-lists"
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
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard title="Total Entities" value={entities.length.toString()} />
              <StatCard title="Columns" value={columns.length.toString()} />
              <StatCard title="Created" value={new Date(baseList.createdAt).toLocaleDateString()} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Entities</CardTitle>
                <CardDescription>
                  All entities in this list ({entities.length} total)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {entities.length === 0 ? (
                  <EmptyEntitiesState 
                  title='No Entities Yet'
                  description="This list doesn't have any entities yet. Add entities to start tracking data."
                  />
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
                          {entities.map((entity, index) => (
                            <tr key={entity.id} className="hover:bg-muted/50">
                              {columns.map((col) => {
                                const value = entity.values[col.id];
                                return (
                                  <td
                                    key={`${entity.id}-${col.id}`}
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

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Base List"
        itemName={baseList?.name || ''}
        isDeleting={isDeleting}
      />
    </>
  );
}
