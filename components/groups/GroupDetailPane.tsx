'use client';

/**
 * Group Detail Pane
 * Prop-driven inline rendering of a single Group's immediate children, modeled
 * on components/base-lists/BaseListDetailPane.tsx.
 * Implements: docs/features/12_groups_workbenches.md §5
 */

import { useCallback, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { DetailPageHeader } from '@/components/shared/DetailPageHeader';
import type { StatCardConfig, HeaderMenuAction } from '@/components/shared/DetailPageHeader';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Plus, Zap, FileText, FolderTree, Users, MoveRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useGroupQuery, useDeleteGroupMutation, useCreateGroupMutation } from '@/lib/client/hooks/data/use-groups';
import { CreateContainerDialog } from '@/components/library/CreateContainerDialog';
import { ApplyTemplateToGroupDialog } from '@/components/groups/ApplyTemplateToGroupDialog';
import { GroupMembersDialog } from '@/components/groups/GroupMembersDialog';
import { MoveGroupDialog } from '@/components/groups/MoveGroupDialog';

export interface GroupDetailPaneProps {
  id: string;
  onDeleted?: () => void;
  onSelectGroup?: (id: string) => void;
  onSelectList?: (id: string) => void;
}

export function GroupDetailPane({ id, onDeleted, onSelectGroup, onSelectList }: GroupDetailPaneProps) {
  const { toast } = useToast();
  const { data: group, isLoading, error, refetch } = useGroupQuery(id);
  const deleteMutation = useDeleteGroupMutation();
  const createGroupMutation = useCreateGroupMutation();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showNewSubgroup, setShowNewSubgroup] = useState(false);
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showMove, setShowMove] = useState(false);

  const childGroups = useMemo(() => group?.childGroups ?? [], [group]);
  const baseLists = useMemo(() => group?.baseLists ?? [], [group]);

  const statCards = useMemo<StatCardConfig[]>(
    () =>
      group
        ? [
            { title: 'Subgroups', value: childGroups.length.toString() },
            { title: 'Base Lists', value: baseLists.length.toString() },
            { title: 'Created', value: new Date(group.createdAt).toLocaleDateString() },
          ]
        : [],
    [group, childGroups.length, baseLists.length],
  );

  const handleOpenDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);

  const moreActions = useMemo<HeaderMenuAction[]>(
    () => [
      { label: 'New subgroup…', icon: <Plus className="h-4 w-4" />, onClick: () => setShowNewSubgroup(true) },
      { label: 'Apply template to group…', icon: <Zap className="h-4 w-4" />, onClick: () => setShowApplyTemplate(true) },
      { label: 'Manage members…', icon: <Users className="h-4 w-4" />, onClick: () => setShowMembers(true) },
      { label: 'Move…', icon: <MoveRight className="h-4 w-4" />, onClick: () => setShowMove(true) },
    ],
    [],
  );

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Group deleted', description: `"${group?.name}" was removed successfully.` });
      setDeleteDialogOpen(false);
      onDeleted?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <InlineErrorState
        error={error instanceof Error ? error.message : 'Group not found'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <DetailPageHeader
        name={group.name}
        description={group.description}
        deleteAriaLabel="Delete group"
        statCards={statCards}
        onDeleteClick={handleOpenDeleteDialog}
        moreActions={moreActions}
      />

      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
        {childGroups.length === 0 && baseLists.length === 0 && (
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">
            No subgroups or lists yet.
          </p>
        )}
        {childGroups.map((child) => (
          <button
            key={child.id}
            onClick={() => onSelectGroup?.(child.id)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
          >
            <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{child.name}</span>
          </button>
        ))}
        {baseLists.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onSelectList?.(entry.baseList.id)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
          >
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate">{entry.baseList.name}</span>
          </button>
        ))}
      </div>

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Group"
        itemName={group.name}
        isDeleting={isDeleting}
      />

      <CreateContainerDialog
        open={showNewSubgroup}
        title="New Subgroup"
        onClose={() => setShowNewSubgroup(false)}
        onSubmit={async (name, description) => {
          await createGroupMutation.mutateAsync({
            workbenchId: group.workbenchId,
            parentGroupId: group.id,
            name,
            description,
          });
        }}
      />

      <ApplyTemplateToGroupDialog
        groupId={id}
        open={showApplyTemplate}
        onClose={() => setShowApplyTemplate(false)}
      />

      <GroupMembersDialog groupId={id} open={showMembers} onClose={() => setShowMembers(false)} />

      <MoveGroupDialog groupId={id} open={showMove} onClose={() => setShowMove(false)} />
    </div>
  );
}
