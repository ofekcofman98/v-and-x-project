'use client';

/**
 * Workspace Page — reads ?list=&table= and renders the template bar + grid
 * for the active Base List. State lives entirely in the URL so switching
 * lists/templates never remounts the layout (sidebar, AppHeader) around it.
 * Implements: docs/features/16_master_detail_workspace.md §3–5
 */

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { WorkspaceGrid } from '@/components/workspace/WorkspaceGrid';
import { useBaseListQuery } from '@/lib/client/hooks/data/use-base-lists';
import type { BaseListWithEntities, BaseListTableSummary } from '@/lib/shared/types/models';

interface BaseListWithTablesDTO extends Omit<BaseListWithEntities, 'createdAt' | 'updatedAt' | 'entities' | 'tables'> {
  tables: BaseListTableSummary[];
}

export default function WorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = searchParams.get('list');
  const tableId = searchParams.get('table');

  const { data, isLoading, error, refetch } = useBaseListQuery(listId);
  const baseList = data as BaseListWithTablesDTO | undefined;
  const tables = baseList?.tables ?? [];

  const selectTable = (id: string) => {
    if (!listId) return;
    router.replace(`/dashboard/workspace?list=${listId}&table=${id}`, { scroll: false });
  };

  // Default to the first template tab once the list's tables are known, so a
  // bare ?list= deep link (or a fresh list selection) lands on a usable grid.
  useEffect(() => {
    if (!listId || tableId || tables.length === 0) return;
    selectTable(tables[0].id);
    // Only re-run when the list or its table set changes — selectTable is
    // recreated every render but is not itself a meaningful dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, tableId, tables]);

  if (!listId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px] border border-dashed border-border rounded-lg text-sm text-muted-foreground">
        Select a list from the sidebar to get started
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !baseList) {
    return <InlineErrorState error={error?.message ?? 'List not found'} onRetry={() => refetch()} />;
  }

  const resolvedTableId = tableId && tables.some((t) => t.id === tableId) ? tableId : undefined;

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        baseListName={baseList.name}
        baseListDescription={baseList.description}
        tables={tables}
        activeTableId={resolvedTableId}
        isLoading={false}
        onSelectTable={selectTable}
      />

      {resolvedTableId ? (
        <WorkspaceGrid tableId={resolvedTableId} />
      ) : tables.length > 0 ? (
        <Skeleton className="h-64 w-full" />
      ) : null}
    </div>
  );
}
