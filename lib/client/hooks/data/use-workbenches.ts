/**
 * Workbench data hooks - TanStack Query wrappers around /api/workbenches
 * Implements: docs/features/12_groups_workbenches.md §3, §5
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export interface WorkbenchGroupSummary {
  id: string;
  name: string;
}

export interface WorkbenchDTO {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkbenchMemberDTO {
  id: string;
  userId: string;
  role: string;
  addedAt: string;
}

export interface WorkbenchWithGroupsDTO extends WorkbenchDTO {
  groups: WorkbenchGroupSummary[];
  members: WorkbenchMemberDTO[];
}

async function fetchWorkbenches(): Promise<WorkbenchDTO[]> {
  const response = await fetch('/api/workbenches');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch workbenches' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch workbenches`);
  }

  const result = await response.json();
  return result.data || [];
}

export function useWorkbenchesQuery() {
  return useQuery({
    queryKey: queryKeys.workbenches.all,
    queryFn: fetchWorkbenches,
  });
}

async function fetchWorkbench(id: string): Promise<WorkbenchWithGroupsDTO> {
  const response = await fetch(`/api/workbenches/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch workbench' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch workbench`);
  }

  const result = await response.json();
  return result.data;
}

export function useWorkbenchQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.workbenches.detail(id ?? ''),
    queryFn: () => fetchWorkbench(id as string),
    enabled: !!id,
  });
}

export interface CreateWorkbenchPayload {
  name: string;
  description?: string;
}

export function useCreateWorkbenchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateWorkbenchPayload): Promise<WorkbenchDTO> => {
      const response = await fetch('/api/workbenches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to create workbench' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workbenches.all });
    },
  });
}

export function useDeleteWorkbenchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/workbenches/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workbenches.all });
    },
  });
}

export interface AddWorkbenchMemberPayload {
  workbenchId: string;
  userId: string;
  role: string;
}

export function useAddWorkbenchMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workbenchId, userId, role }: AddWorkbenchMemberPayload) => {
      const response = await fetch(`/api/workbenches/${workbenchId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to add member' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workbenches.detail(variables.workbenchId) });
    },
  });
}

export interface RemoveWorkbenchMemberPayload {
  workbenchId: string;
  userId: string;
}

export function useRemoveWorkbenchMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workbenchId, userId }: RemoveWorkbenchMemberPayload) => {
      const response = await fetch(`/api/workbenches/${workbenchId}/members/${userId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to remove member' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workbenches.detail(variables.workbenchId) });
    },
  });
}
