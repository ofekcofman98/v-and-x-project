'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function ConfirmationDialog() {
  const pendingConfirmation = useUIStore((state) => state.pendingConfirmation);
  const recordingState = useUIStore((state) => state.recordingState);
  const confirmEntry = useUIStore((state) => state.confirmEntry);
  const cancelEntry = useUIStore((state) => state.cancelEntry);

  if (!pendingConfirmation) {
    return null;
  }

  const isOpen = recordingState === 'confirming' && Boolean(pendingConfirmation);
  const formattedValue =
    pendingConfirmation.value === null ? '—' : String(pendingConfirmation.value);
  const confidencePercent = Math.round(pendingConfirmation.confidence * 100);

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      const { recordingState: freshState } = useUIStore.getState();
      if (freshState === 'confirming') {
        cancelEntry();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="gap-1">
          <DialogTitle>Confirm voice entry</DialogTitle>
          <DialogDescription>
            We parsed an entry for <span className="font-semibold">{pendingConfirmation.entity}</span>{' '}
            with <span className="font-semibold">{confidencePercent}%</span> confidence. Please confirm
            or cancel before we commit the change.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Entity</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {pendingConfirmation.entity || '—'}
            </span>
          </div>
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Value</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{formattedValue}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Confidence</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {confidencePercent}%
            </span>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="ghost" onClick={cancelEntry}>
            Cancel
          </Button>
          <Button onClick={confirmEntry}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
