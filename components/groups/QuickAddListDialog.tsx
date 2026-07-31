'use client';

/**
 * QuickAddListDialog
 * Compact "add an existing (unassigned) list to this group" picker — the
 * inline quick-add affordance from a tree row, without a full Move flow.
 * Implements: docs/features/12_groups_workbenches.md §9.5
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useBaseListsQuery } from '@/lib/client/hooks/data/use-base-lists';
import { useAssignedListsQuery, useAddBaseListToGroupMutation } from '@/lib/client/hooks/data/use-groups';

export interface QuickAddListDialogProps {
  groupId: string;
  open: boolean;
  onClose: () => void;
}

export function QuickAddListDialog({ groupId, open, onClose }: QuickAddListDialogProps) {
  const { toast } = useToast();
  const listsQuery = useBaseListsQuery();
  const assignedListsQuery = useAssignedListsQuery();
  const addMutation = useAddBaseListToGroupMutation();

  const isLoading = listsQuery.isLoading || assignedListsQuery.isLoading;
  const assignedIds = new Set((assignedListsQuery.data ?? []).map((a) => a.baseListId));
  const unassigned = (listsQuery.data ?? []).filter((l) => !assignedIds.has(l.id));

  const handleAdd = async (baseListId: string) => {
    try {
      await addMutation.mutateAsync({ groupId, baseListId });
      toast({ title: 'List added to group' });
    } catch (err) {
      toast({
        title: 'Failed to add list',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Existing List</DialogTitle>
          <DialogDescription>Only unassigned lists are shown.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
            {unassigned.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                No unassigned lists — everything is already organized.
              </p>
            )}
            {unassigned.map((list) => (
              <div key={list.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-medium truncate">{list.name}</span>
                <Button size="sm" variant="outline" onClick={() => handleAdd(list.id)} disabled={addMutation.isPending}>
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
