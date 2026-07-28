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

async function fetchColumnTemplate(id: string): Promise<ColumnTemplateDTO> {
  const response = await fetch(`/api/column-templates/${id}`, { headers: TEMP_USER_HEADER });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch template' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch template`);
  }

  const result = await response.json();
  return result.data;
}

export function useColumnTemplateQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.columnTemplates.detail(id ?? ''),
    queryFn: () => fetchColumnTemplate(id as string),
    enabled: !!id,
  });
}

export interface CreateColumnTemplatePayload {
  name: string;
  description?: string;
  category?: string | null;
  schema: { columns: Array<{ id: string; label: string; type: string; validation?: Record<string, unknown> }> };
  is_public?: boolean;
}

export function useCreateColumnTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateColumnTemplatePayload): Promise<ColumnTemplateDTO> => {
      const response = await fetch('/api/column-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TEMP_USER_HEADER },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to create template' }));
        throw new Error(
          Array.isArray(data.error) ? data.error.join(', ') : data.error || `HTTP ${response.status}`
        );
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.columnTemplates.all });
    },
  });
}

export interface UpdateColumnTemplateSchemaPayload {
  id: string;
  schema: { columns: Array<{ id: string; label: string; type: string; validation?: Record<string, unknown> }> };
}

export function useUpdateColumnTemplateSchemaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, schema }: UpdateColumnTemplateSchemaPayload) => {
      const response = await fetch(`/api/column-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TEMP_USER_HEADER },
        body: JSON.stringify({ schema }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to update template' }));
        throw new Error(
          Array.isArray(data.error) ? data.error.join(', ') : data.error || `HTTP ${response.status}`
        );
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.columnTemplates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.columnTemplates.detail(variables.id) });
    },
  });
}

export interface ApplyTemplatePayload {
  baseListId: string;
  templateId: string;
  autoSync?: boolean;
  selectedBaseListColumnIds?: string[];
}

export function useApplyTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ baseListId, templateId, autoSync, selectedBaseListColumnIds }: ApplyTemplatePayload) => {
      const response = await fetch(`/api/base-lists/${baseListId}/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TEMP_USER_HEADER },
        body: JSON.stringify({ templateId, autoSync, selectedBaseListColumnIds }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to apply template' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.baseLists.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.baseLists.detail(variables.baseListId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.columnTemplates.all });
    },
  });
}
