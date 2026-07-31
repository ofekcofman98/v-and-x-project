/**
 * Group data hooks - TanStack Query wrappers around /api/groups
 * Implements: docs/features/12_groups_workbenches.md §3, §5
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export interface GroupBaseListSummary {
  id: string;
  name: string;
}

export interface GroupChildSummary {
  id: string;
  name: string;
}

export interface GroupDTO {
  id: string;
  workbenchId: string;
  parentGroupId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberDTO {
  id: string;
  userId: string;
  role: string;
  addedAt: string;
}

export interface GroupWithChildrenDTO extends GroupDTO {
  childGroups: GroupChildSummary[];
  baseLists: Array<{ id: string; baseListId: string; baseList: GroupBaseListSummary }>;
  members: GroupMemberDTO[];
}

export interface GroupTreeNode {
  id: string;
  name: string;
  description: string | null;
  childGroups: GroupTreeNode[];
  baseLists: GroupBaseListSummary[];
}

async function fetchGroup(id: string): Promise<GroupWithChildrenDTO> {
  const response = await fetch(`/api/groups/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch group' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch group`);
  }

  const result = await response.json();
  return result.data;
}

export function useGroupQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.groups.detail(id ?? ''),
    queryFn: () => fetchGroup(id as string),
    enabled: !!id,
  });
}

async function fetchGroupTree(id: string): Promise<GroupTreeNode> {
  const response = await fetch(`/api/groups/${id}/tree`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch group tree' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch group tree`);
  }

  const result = await response.json();
  return result.data;
}

export function useGroupTreeQuery(id: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.groups.tree(id ?? ''),
    queryFn: () => fetchGroupTree(id as string),
    enabled: !!id && (options?.enabled ?? true),
  });
}

export interface CreateGroupPayload {
  workbenchId: string;
  parentGroupId?: string;
  name: string;
  description?: string;
}

export function useCreateGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateGroupPayload): Promise<GroupDTO> => {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to create group' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workbenches.detail(variables.workbenchId) });
      if (variables.parentGroupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.tree(variables.parentGroupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.parentGroupId) });
      }
    },
  });
}

export interface UpdateGroupPayload {
  id: string;
  name?: string;
  description?: string;
  settings?: Record<string, unknown>;
  parentGroupId?: string | null;
}

export function useUpdateGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateGroupPayload): Promise<GroupDTO> => {
      const response = await fetch(`/api/groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to update group' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: (_data, variables) => {
      // Re-parenting can move a group under a different tree branch — the old
      // and new parent's tree ids aren't known client-side, so invalidate
      // broadly rather than guessing, matching useDeleteGroupMutation's precedent.
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.tree(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workbenches.all });
    },
  });
}

export function useDeleteGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/groups/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workbenches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
  });
}

export interface AddBaseListToGroupPayload {
  groupId: string;
  baseListId: string;
}

export function useAddBaseListToGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, baseListId }: AddBaseListToGroupPayload) => {
      const response = await fetch(`/api/groups/${groupId}/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseListId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to add list to group' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.tree(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.assignedLists });
    },
  });
}

export function useRemoveBaseListFromGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, baseListId }: AddBaseListToGroupPayload) => {
      const response = await fetch(`/api/groups/${groupId}/lists/${baseListId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to remove list from group' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.tree(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.assignedLists });
    },
  });
}

export interface AssignedBaseListEntry {
  baseListId: string;
  groupId: string;
  groupName: string;
  workbenchId: string;
  workbenchName: string;
}

async function fetchAssignedLists(): Promise<AssignedBaseListEntry[]> {
  const response = await fetch('/api/groups/assigned-lists');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch assigned lists' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch assigned lists`);
  }

  const result = await response.json();
  return result.data || [];
}

export function useAssignedListsQuery() {
  return useQuery({
    queryKey: queryKeys.groups.assignedLists,
    queryFn: fetchAssignedLists,
  });
}

export interface ApplyTemplateToGroupResultRow {
  baseListId: string;
  baseListName: string;
  groupPath: string;
  status: 'created' | 'failed';
  tableId?: string;
  error?: string;
}

export interface ApplyTemplateToGroupResult {
  results: ApplyTemplateToGroupResultRow[];
  createdCount: number;
  failedCount: number;
}

export interface ApplyTemplateToGroupPayload {
  groupId: string;
  templateId: string;
  autoSync?: boolean;
  selectedBaseListColumnIds?: string[];
}

export function useApplyTemplateToGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      templateId,
      autoSync,
      selectedBaseListColumnIds,
    }: ApplyTemplateToGroupPayload): Promise<ApplyTemplateToGroupResult> => {
      const response = await fetch(`/api/groups/${groupId}/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, autoSync, selectedBaseListColumnIds }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to apply template to group' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.tree(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.baseLists.all });
    },
  });
}

export interface AddGroupMemberPayload {
  groupId: string;
  userId: string;
  role: string;
}

export function useAddGroupMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, userId, role }: AddGroupMemberPayload) => {
      const response = await fetch(`/api/groups/${groupId}/members`, {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
    },
  });
}

export interface RemoveGroupMemberPayload {
  groupId: string;
  userId: string;
}

export function useRemoveGroupMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, userId }: RemoveGroupMemberPayload) => {
      const response = await fetch(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to remove member' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
    },
  });
}
