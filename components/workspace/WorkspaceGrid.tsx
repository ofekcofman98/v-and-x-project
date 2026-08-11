'use client';

/**
 * WorkspaceGrid — fetches the active Table (cached per docs/features/
 * 16_master_detail_workspace.md §6) and renders the shared grid stack
 * unchanged. Owns the pointer/voice reset transition via useActiveTable.
 */

import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { TableGridSection } from '@/components/shared-table/TableGridSection';
import { GridChatButton } from '@/components/ai/GridChatButton';
import { GridChatPanel } from '@/components/ai/GridChatPanel';
import { useTableQuery } from '@/lib/client/hooks/data/use-tables';
import { useActiveTable } from '@/lib/client/hooks/shared/use-active-table';
import {
  deriveTableColumns,
  deriveTableRows,
  type TableWithRelationsDTO,
} from '@/lib/shared/utils/table-schema-derivation';
import type { TableSchema } from '@/lib/shared/types/table-schema';

export interface WorkspaceGridProps {
  tableId: string;
}

export function WorkspaceGrid({ tableId }: WorkspaceGridProps) {
  const { data, isLoading, error, refetch } = useTableQuery(tableId);
  const table = data as TableWithRelationsDTO | undefined;

  const columns = useMemo(() => deriveTableColumns(table), [table]);
  const rows = useMemo(() => deriveTableRows(table, columns), [table, columns]);
  const tableSchema = useMemo<TableSchema>(() => ({ columns, rows }), [columns, rows]);

  useActiveTable({ tableId, tableSchema });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <InlineErrorState error={error.message} onRetry={() => refetch()} />;
  }

  const hasData = rows.length > 0 && columns.length > 0;

  return (
    <div key={tableId} className="transition-opacity duration-150">
      <TableGridSection
        tableId={tableId}
        columns={columns}
        rows={rows}
        hasData={hasData}
        totalRows={rows.length}
      />

      {hasData && (
        <>
          <div className="fixed bottom-8 left-8 z-50">
            <GridChatButton tableId={tableId} />
          </div>
          <GridChatPanel tableId={tableId} />
        </>
      )}
    </div>
  );
}
