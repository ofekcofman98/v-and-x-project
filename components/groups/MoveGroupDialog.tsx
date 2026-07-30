'use client';

/**
 * MoveGroupDialog
 * Re-parents a Group elsewhere within the same Workbench (PATCH /api/groups/:id
 * with a new parentGroupId) — moving the GROUP node itself, distinct from
 * MoveListDialog (planned, §9) which moves a BaseList leaf.
 * Implements: docs/features/12_groups_workbenches.md §8 Phase 4
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { useToast } from '@/components/ui/use-toast';
import { useGroupQuery, useUpdateGroupMutation, useGroupTreeQuery, type GroupTreeNode } from '@/lib/client/hooks/data/use-groups';
import { useWorkbenchQuery } from '@/lib/client/hooks/data/use-workbenches';

export interface MoveGroupDialogProps {
  groupId: string;
  open: boolean;
  onClose: () => void;
}

interface FlatOption {
  id: string;
  name: string;
  depth: number;
}

/**
 * Flattens a tree into a depth-annotated list, skipping `excludeIds` nodes
 * AND their entire subtree — a group's own descendants must never appear as
 * valid "move here" targets (the server's cycle guard would reject them
 * anyway, but the picker shouldn't offer them in the first place).
 */
function flattenGroupTree(node: GroupTreeNode, depth: number, excludeIds: Set<string>, out: FlatOption[]) {
  if (excludeIds.has(node.id)) return;
  out.push({ id: node.id, name: node.name, depth });
  node.childGroups.forEach((child) => flattenGroupTree(child, depth + 1, excludeIds, out));
}

/** One top-level group's subtree, fetched eagerly for this dialog (small — bounded by GROUP_MAX_DEPTH/50-list caps elsewhere). */
function TopGroupOptions({
  id,
  excludeIds,
  onLoaded,
}: {
  id: string;
  excludeIds: Set<string>;
  onLoaded: (options: FlatOption[]) => void;
}) {
  const { data: tree } = useGroupTreeQuery(id);

  useEffect(() => {
    if (!tree) return;
    const options: FlatOption[] = [];
    flattenGroupTree(tree, 0, excludeIds, options);
    onLoaded(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  return null;
}

export function MoveGroupDialog({ groupId, open, onClose }: MoveGroupDialogProps) {
  const { toast } = useToast();
  const { data: group, isLoading, error } = useGroupQuery(open ? groupId : null);
  const workbenchQuery = useWorkbenchQuery(group?.workbenchId ?? null);
  const updateGroupMutation = useUpdateGroupMutation();

  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [optionsByTopGroup, setOptionsByTopGroup] = useState<Record<string, FlatOption[]>>({});

  useEffect(() => {
    if (open) {
      setSelectedParentId('');
      setOptionsByTopGroup({});
    }
  }, [open, groupId]);

  const excludeIds = useMemo(() => new Set<string>([groupId]), [groupId]);

  const topGroups = workbenchQuery.data?.groups ?? [];

  const allOptions = useMemo(
    () => Object.values(optionsByTopGroup).flat(),
    [optionsByTopGroup],
  );

  const handleSubmit = async () => {
    try {
      await updateGroupMutation.mutateAsync({
        id: groupId,
        parentGroupId: selectedParentId || null,
      });
      toast({ title: 'Group moved' });
      onClose();
    } catch (err) {
      toast({
        title: 'Failed to move group',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move Group</DialogTitle>
          <DialogDescription>
            Choose a new parent within the same Workbench, or move it to the top level.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : error || !group ? (
          <InlineErrorState error={error instanceof Error ? error.message : 'Failed to load group'} onRetry={() => {}} />
        ) : (
          <>
            {open &&
              topGroups
                .filter((g) => !excludeIds.has(g.id))
                .map((g) => (
                  <TopGroupOptions
                    key={g.id}
                    id={g.id}
                    excludeIds={excludeIds}
                    onLoaded={(options) => {
                      setOptionsByTopGroup((prev) => ({ ...prev, [g.id]: options }));
                    }}
                  />
                ))}

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="move-group-select">
                New parent
              </label>
              <select
                id="move-group-select"
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Top-level (no parent)</option>
                {allOptions
                  .filter((opt) => opt.id !== group.parentGroupId)
                  .map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {'  '.repeat(opt.depth)}
                      {opt.name}
                    </option>
                  ))}
              </select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={updateGroupMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={updateGroupMutation.isPending}>
                {updateGroupMutation.isPending ? 'Moving...' : 'Move'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
