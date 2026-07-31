'use client';

/**
 * MoveListDialog
 * Moves a BaseList to a different Group/Workbench (or to "no group") —
 * single-homed: removes it from wherever it currently sits first.
 * Implements: docs/features/12_groups_workbenches.md §9.1, §9.3
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useWorkbenchesQuery, useWorkbenchQuery } from '@/lib/client/hooks/data/use-workbenches';
import {
  useAssignedListsQuery,
  useAddBaseListToGroupMutation,
  useRemoveBaseListFromGroupMutation,
  useGroupTreeQuery,
  type GroupTreeNode,
} from '@/lib/client/hooks/data/use-groups';

export interface MoveListDialogProps {
  baseListId: string;
  baseListName: string;
  open: boolean;
  onClose: () => void;
}

const NO_WORKBENCH_VALUE = '__none__';
const NO_GROUP_VALUE = '__top__';

interface FlatOption {
  id: string;
  name: string;
  depth: number;
}

function flattenGroupTree(node: GroupTreeNode, depth: number, out: FlatOption[]) {
  out.push({ id: node.id, name: node.name, depth });
  node.childGroups.forEach((child) => flattenGroupTree(child, depth + 1, out));
}

export function MoveListDialog({ baseListId, baseListName, open, onClose }: MoveListDialogProps) {
  const { toast } = useToast();
  const workbenchesQuery = useWorkbenchesQuery();
  const assignedListsQuery = useAssignedListsQuery();
  const addMutation = useAddBaseListToGroupMutation();
  const removeMutation = useRemoveBaseListFromGroupMutation();

  const currentAssignment = useMemo(
    () => assignedListsQuery.data?.find((a) => a.baseListId === baseListId) ?? null,
    [assignedListsQuery.data, baseListId],
  );

  const [selectedWorkbenchId, setSelectedWorkbenchId] = useState<string>(NO_WORKBENCH_VALUE);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(NO_GROUP_VALUE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedWorkbenchId(currentAssignment?.workbenchId ?? NO_WORKBENCH_VALUE);
      setSelectedGroupId(currentAssignment?.groupId ?? NO_GROUP_VALUE);
    }
  }, [open, currentAssignment]);

  const workbenches = workbenchesQuery.data ?? [];
  const activeWorkbenchId = selectedWorkbenchId === NO_WORKBENCH_VALUE ? null : selectedWorkbenchId;
  const workbenchDetailQuery = useWorkbenchQuery(activeWorkbenchId);
  const topGroups = workbenchDetailQuery.data?.groups ?? [];

  const [optionsByTopGroup, setOptionsByTopGroup] = useState<Record<string, FlatOption[]>>({});
  const allGroupOptions = useMemo(() => Object.values(optionsByTopGroup).flat(), [optionsByTopGroup]);

  useEffect(() => {
    setOptionsByTopGroup({});
  }, [activeWorkbenchId]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (currentAssignment) {
        await removeMutation.mutateAsync({ groupId: currentAssignment.groupId, baseListId });
      }
      if (selectedGroupId !== NO_GROUP_VALUE) {
        await addMutation.mutateAsync({ groupId: selectedGroupId, baseListId });
      }
      toast({ title: 'List moved' });
      handleClose();
    } catch (err) {
      toast({
        title: 'Failed to move list',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move &ldquo;{baseListName}&rdquo;</DialogTitle>
          <DialogDescription>
            Choose a Workbench and Group to organize this list under, or leave it ungrouped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Workbench</label>
            <Select
              value={selectedWorkbenchId}
              onValueChange={(value) => {
                setSelectedWorkbenchId(value);
                setSelectedGroupId(NO_GROUP_VALUE);
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_WORKBENCH_VALUE}>No workbench</SelectItem>
                {workbenches.map((wb) => (
                  <SelectItem key={wb.id} value={wb.id}>
                    {wb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeWorkbenchId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value={NO_GROUP_VALUE}>Top-level / No Group</option>
                {allGroupOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {'  '.repeat(opt.depth)}
                    {opt.name}
                  </option>
                ))}
              </select>
              {topGroups.map((g) => (
                <GroupOptionsLoader
                  key={g.id}
                  id={g.id}
                  onLoaded={(options) => setOptionsByTopGroup((prev) => ({ ...prev, [g.id]: options }))}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Moving...' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Eagerly loads one top-level group's full subtree and reports flattened options up. */
function GroupOptionsLoader({ id, onLoaded }: { id: string; onLoaded: (options: FlatOption[]) => void }) {
  const { data: tree } = useGroupTreeQuery(id);

  useEffect(() => {
    if (!tree) return;
    const options: FlatOption[] = [];
    flattenGroupTree(tree, 0, options);
    onLoaded(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  return null;
}
