'use client';

/**
 * Confirmation dialog for a Global Agent write proposal — the
 * human-in-the-loop gate before any updateCellsBatch executes.
 * Mirrors GridActionConfirmDialog.tsx.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGlobalChatStore } from '@/lib/client/stores/global-chat-store';
import { useGlobalAgentExecuteMutation } from '@/lib/client/hooks/ai/use-global-agent';
import { useTableCellStore } from '@/lib/client/stores/table-cell-store';

export function GlobalActionConfirmDialog() {
  const isConfirmDialogOpen = useGlobalChatStore((s) => s.isConfirmDialogOpen);
  const pendingAction = useGlobalChatStore((s) => s.pendingAction);
  const clearPendingAction = useGlobalChatStore((s) => s.clearPendingAction);
  const appendMessage = useGlobalChatStore((s) => s.appendMessage);

  const executeMutation = useGlobalAgentExecuteMutation();
  const isExecuting = executeMutation.isPending;

  function handleCancel() {
    if (isExecuting) return;
    clearPendingAction();
  }

  function handleConfirm() {
    if (!pendingAction) return;
    const targetTableId = pendingAction.updates[0]?.tableId;

    executeMutation.mutate(
      { actionId: pendingAction.actionId },
      {
        onSuccess: (result) => {
          const summary =
            result.failed.length > 0
              ? `Applied ${result.updated} update(s), ${result.failed.length} failed.`
              : `Applied ${result.updated} update(s).`;
          appendMessage({ role: 'assistant', content: summary });
          clearPendingAction();

          // Best-effort: only refresh the grid if the target table happens to
          // be the one currently loaded elsewhere in the app — the Global
          // Agent isn't scoped to any particular open page.
          if (targetTableId && useTableCellStore.getState().loadedTableId === targetTableId) {
            useTableCellStore.getState().fetchCells(targetTableId, { force: true });
          }
        },
        onError: (err) => {
          appendMessage({ role: 'assistant', content: `Couldn't apply that change: ${err.message}` });
          clearPendingAction();
        },
      }
    );
  }

  return (
    <AlertDialog open={isConfirmDialogOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm changes</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{pendingAction?.summary}</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {pendingAction?.updates.map((update, index) => (
                  <li
                    key={`${update.rowKey}-${update.columnKey}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-900"
                  >
                    <span className="font-medium">{update.columnKey}</span>
                    <span>{String(update.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExecuting} onClick={handleCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isExecuting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isExecuting ? 'Applying…' : 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
