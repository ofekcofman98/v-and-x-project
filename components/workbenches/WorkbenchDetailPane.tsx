'use client';

/**
 * Workbench Detail Pane
 * Prop-driven inline rendering of a Workbench's top-level Group tree.
 * Implements: docs/features/12_groups_workbenches.md §5
 */

import { useCallback, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { DetailPageHeader } from '@/components/shared/DetailPageHeader';
import type { StatCardConfig } from '@/components/shared/DetailPageHeader';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useWorkbenchQuery, useDeleteWorkbenchMutation } from '@/lib/client/hooks/data/use-workbenches';
import { useCreateGroupMutation } from '@/lib/client/hooks/data/use-groups';
import { GroupTreeRoot } from '@/components/groups/GroupTree';
import { CreateContainerDialog } from '@/components/library/CreateContainerDialog';
import { WorkbenchMembersDialog } from '@/components/workbenches/WorkbenchMembersDialog';

export interface WorkbenchDetailPaneProps {
  id: string;
  onDeleted?: () => void;
  onSelectGroup?: (id: string) => void;
  onSelectList?: (id: string) => void;
}

export function WorkbenchDetailPane({ id, onDeleted, onSelectGroup, onSelectList }: WorkbenchDetailPaneProps) {
  const { toast } = useToast();
  const { data: workbench, isLoading, error, refetch } = useWorkbenchQuery(id);
  const createGroupMutation = useCreateGroupMutation();
  const deleteMutation = useDeleteWorkbenchMutation();
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const topGroups = useMemo(() => workbench?.groups ?? [], [workbench]);

  const statCards = useMemo<StatCardConfig[]>(
    () =>
      workbench
        ? [
            { title: 'Top-Level Groups', value: topGroups.length.toString() },
            { title: 'Created', value: new Date(workbench.createdAt).toLocaleDateString() },
          ]
        : [],
    [workbench, topGroups.length],
  );

  const handleOpenDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Workbench deleted', description: `"${workbench?.name}" was removed successfully.` });
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

  if (error || !workbench) {
    return (
      <InlineErrorState
        error={error instanceof Error ? error.message : 'Workbench not found'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <DetailPageHeader
        name={workbench.name}
        description={workbench.description}
        deleteAriaLabel="Delete workbench"
        statCards={statCards}
        onDeleteClick={handleOpenDeleteDialog}
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowMembers(true)}>
          <Users className="h-4 w-4 mr-2" />
          Manage members
        </Button>
      </div>

      <div className="border border-slate-200 rounded-lg p-2">
        <GroupTreeRoot
          topGroups={topGroups}
          selection={null}
          onSelectGroup={(groupId) => onSelectGroup?.(groupId)}
          onSelectList={(listId) => onSelectList?.(listId)}
          onCreateGroup={() => setShowNewGroup(true)}
        />
      </div>

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Workbench"
        itemName={workbench.name}
        isDeleting={isDeleting}
      />

      <CreateContainerDialog
        open={showNewGroup}
        title="New Group"
        onClose={() => setShowNewGroup(false)}
        onSubmit={async (name, description) => {
          await createGroupMutation.mutateAsync({ workbenchId: id, name, description });
        }}
      />

      <WorkbenchMembersDialog workbenchId={id} open={showMembers} onClose={() => setShowMembers(false)} />
    </div>
  );
}
