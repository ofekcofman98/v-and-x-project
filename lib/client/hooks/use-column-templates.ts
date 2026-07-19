/**
 * Column Templates data hooks - TanStack Query wrappers around /api/column-templates
 * Implements: docs/features/11_perf_and_navigation.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { ColumnTemplateDTO } from '@/lib/client/stores/column-template-store';

// TODO: Replace x-user-id with real auth header once session is wired up
const TEMP_USER_HEADER = { 'x-user-id': '00000000-0000-0000-0000-000000000000' };

async function fetchColumnTemplates(): Promise<ColumnTemplateDTO[]> {
  const response = await fetch('/api/column-templates', { headers: TEMP_USER_HEADER });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch templates' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch templates`);
  }

  const result = await response.json();
  return result.data?.data ?? result.data ?? [];
}

export function useColumnTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.columnTemplates.all,
    queryFn: fetchColumnTemplates,
  });
}

export function useDeleteColumnTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/column-templates/${id}`, {
        method: 'DELETE',
        headers: TEMP_USER_HEADER,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(
          Array.isArray(data.error) ? data.error.join(', ') : data.error || `HTTP ${response.status}`
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.columnTemplates.all });
    },
  });
}
