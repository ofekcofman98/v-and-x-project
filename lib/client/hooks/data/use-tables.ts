/**
 * Tables data hooks - TanStack Query wrappers around /api/tables
 * Implements: docs/features/11_perf_and_navigation.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { TableDTO } from '@/lib/shared/types/models';

async function fetchTables(): Promise<TableDTO[]> {
  const response = await fetch('/api/tables');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch tables' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch tables`);
  }

  const result = await response.json();
  return result.data || [];
}

export function useTablesQuery() {
  return useQuery({
    queryKey: queryKeys.tables.all,
    queryFn: fetchTables,
  });
}

async function fetchTable(id: string) {
  const response = await fetch(`/api/tables/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch table' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch table`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Fetches a single Table with its columns/cells/baseList. Powers the
 * workspace grid (docs/features/16_master_detail_workspace.md §6), replacing
 * the hand-rolled useState/useEffect/fetch previously local to
 * app/dashboard/tables/[id]/page.tsx so template-tab revisits are cached.
 */
export function useTableQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tables.detail(id ?? ''),
    queryFn: () => fetchTable(id as string),
    enabled: !!id,
  });
}

export function useDeleteTableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tables/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all });
    },
  });
}
