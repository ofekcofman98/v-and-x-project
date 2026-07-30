'use client';

/**
 * ApplyTemplateToGroupDialog
 * Bulk-applies a Column Template to every BaseList under a Group's subtree.
 * Unlike ApplyTemplateDialog (single-list, per-list checklist), the target
 * here is implicit (the group's whole subtree, per the Phase 2 endpoint), so
 * this is just a template picker + autoSync toggle + a per-list result view.
 * Implements: docs/features/12_groups_workbenches.md §3.1, §5
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/shared/utils/cn';
import { useColumnTemplatesQuery } from '@/lib/client/hooks/data/use-column-templates';
import {
  useApplyTemplateToGroupMutation,
  type ApplyTemplateToGroupResult,
} from '@/lib/client/hooks/data/use-groups';

export interface ApplyTemplateToGroupDialogProps {
  groupId: string;
  open: boolean;
  onClose: () => void;
}

export function ApplyTemplateToGroupDialog({ groupId, open, onClose }: ApplyTemplateToGroupDialogProps) {
  const templatesQuery = useColumnTemplatesQuery();
  const applyMutation = useApplyTemplateToGroupMutation();

  const [templateId, setTemplateId] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [result, setResult] = useState<ApplyTemplateToGroupResult | null>(null);

  useEffect(() => {
    if (open) {
      setTemplateId('');
      setAutoSync(false);
      setResult(null);
    }
  }, [open]);

  const templates = templatesQuery.data ?? [];

  const handleApply = async () => {
    if (!templateId) return;
    const data = await applyMutation.mutateAsync({ groupId, templateId, autoSync });
    setResult(data);
  };

  const handleClose = () => {
    if (applyMutation.isPending) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply Template to Group</DialogTitle>
          <DialogDescription>
            Applies the template to every list in this group and its subgroups — one table per list.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="apply-template-select">
                Template
              </label>
              <select
                id="apply-template-select"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-muted/20 transition-colors select-none">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary"
              />
              <div>
                <p className="text-sm font-medium">Enable Auto-Sync</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Future schema changes to this template will automatically update every linked list.
                </p>
              </div>
            </label>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={applyMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={!templateId || applyMutation.isPending}>
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Apply to Group
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="max-h-[280px] overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
              {result.results.map((row) => (
                <div key={row.baseListId} className="flex items-center gap-3 px-4 py-3">
                  {row.status === 'created' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.baseListName}</p>
                    <p className={cn('text-xs mt-0.5 truncate', row.status === 'failed' && 'text-destructive')}>
                      {row.groupPath} {row.status === 'failed' && row.error ? `— ${row.error}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {result.createdCount} created
              {result.failedCount > 0 ? `, ${result.failedCount} failed` : ''}
            </p>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
