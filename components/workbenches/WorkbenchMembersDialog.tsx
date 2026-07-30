'use client';

/**
 * WorkbenchMembersDialog
 * Lists a Workbench's members and lets the caller invite by email / remove.
 * Implements: docs/features/12_groups_workbenches.md §8 Phase 4
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  useWorkbenchQuery,
  useAddWorkbenchMemberMutation,
  useRemoveWorkbenchMemberMutation,
} from '@/lib/client/hooks/data/use-workbenches';
import { EmailInviteRow } from '@/components/library/EmailInviteRow';

export interface WorkbenchMembersDialogProps {
  workbenchId: string;
  open: boolean;
  onClose: () => void;
}

export function WorkbenchMembersDialog({ workbenchId, open, onClose }: WorkbenchMembersDialogProps) {
  const { toast } = useToast();
  const { data: workbench, isLoading, error, refetch } = useWorkbenchQuery(open ? workbenchId : null);
  const addMemberMutation = useAddWorkbenchMemberMutation();
  const removeMemberMutation = useRemoveWorkbenchMemberMutation();

  const members = workbench?.members ?? [];

  const handleInvite = async (userId: string, role: string) => {
    try {
      await addMemberMutation.mutateAsync({ workbenchId, userId, role });
      toast({ title: 'Member added' });
    } catch (err) {
      toast({
        title: 'Failed to add member',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeMemberMutation.mutateAsync({ workbenchId, userId });
    } catch (err) {
      toast({
        title: 'Failed to remove member',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>
            Members added here can access every Group in this Workbench.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : error || !workbench ? (
          <InlineErrorState error={error instanceof Error ? error.message : 'Failed to load'} onRetry={() => refetch()} />
        ) : (
          <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-4 text-center">No members yet.</p>
            )}
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{m.userId}</p>
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                </div>
                <button
                  onClick={() => handleRemove(m.userId)}
                  aria-label="Remove member"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <EmailInviteRow onInvite={handleInvite} />
      </DialogContent>
    </Dialog>
  );
}
