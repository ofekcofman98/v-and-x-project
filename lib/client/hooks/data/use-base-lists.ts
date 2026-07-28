/**
 * Base Lists data hooks - TanStack Query wrappers around /api/base-lists
 * Implements: docs/features/11_perf_and_navigation.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { BaseListDTO } from '@/lib/shared/types/models';

async function fetchBaseLists(): Promise<BaseListDTO[]> {
  const response = await fetch('/api/base-lists');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch lists' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch lists`);
  }

  const result = await response.json();
  return result.data || [];
}

export function useBaseListsQuery() {
  return useQuery({
    queryKey: queryKeys.baseLists.all,
    queryFn: fetchBaseLists,
  });
}

export function useDeleteBaseListMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/base-lists/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.baseLists.all });
    },
  });
}

async function fetchBaseList(id: string) {
  const response = await fetch(`/api/base-lists/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch list' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch list`);
  }

  const result = await response.json();
  return result.data;
}

export function useBaseListQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.baseLists.detail(id ?? ''),
    queryFn: () => fetchBaseList(id as string),
    enabled: !!id,
  });
}

export interface CreateBaseListPayload {
  name: string;
  description?: string;
  schema: { columns: Array<{ id: string; label: string; type: string; validation?: Record<string, unknown> }> };
  entities?: Array<{ values: Record<string, string | number | boolean> }>;
}

export function useCreateBaseListMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateBaseListPayload): Promise<BaseListDTO> => {
      const response = await fetch('/api/base-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to create list' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.baseLists.all });
    },
  });
}
