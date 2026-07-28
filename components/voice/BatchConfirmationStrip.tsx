'use client';

/**
 * BatchConfirmationStrip
 * Renders one chip per BatchCellWrite from a Multi-Entity Batch Voice Entry
 * result — auto-committed, disambiguation, unresolved, or parse-error — plus
 * a row-first overflow notice, then a single "Confirm all resolved" action.
 * Reuses ConfirmationDialog's visual language (same badge/button primitives)
 * rather than introducing new ones.
 * Based on: docs/features/03_ai_table_agent.md §5
 */

import { useUIStore } from '@/lib/client/stores/ui-store';
import { useVoiceBatchHandler } from '@/lib/client/hooks/voice/use-voice-batch-handler';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shared/utils/cn';
import type { TableSchema } from '@/lib/shared/types/table-schema';

interface BatchConfirmationStripProps {
  tableId: string;
  tableSchema: TableSchema;
}

export function BatchConfirmationStrip({ tableId, tableSchema }: BatchConfirmationStripProps) {
  const pendingBatchConfirmation = useUIStore((s) => s.pendingBatchConfirmation);
  const batchOverflowCount = useUIStore((s) => s.batchOverflowCount);
  const recordingState = useUIStore((s) => s.recordingState);
  const setPendingBatchConfirmation = useUIStore((s) => s.setPendingBatchConfirmation);
  const setRecordingState = useUIStore((s) => s.setRecordingState);

  const { confirmBatch, resolveDisambiguation, dismissWrite } = useVoiceBatchHandler({
    tableId,
    tableSchema,
  });

  if (!pendingBatchConfirmation || recordingState !== 'confirming') {
    return null;
  }

  const resolvedCount = pendingBatchConfirmation.filter((w) => w.confidenceRoute === 'auto').length;

  const handleCancel = () => {
    setPendingBatchConfirmation(null);
    setRecordingState('idle');
  };

  return (
    <div className="mt-4 w-full max-w-lg space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/80">
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Batch voice entry — {pendingBatchConfirmation.length} value
        {pendingBatchConfirmation.length === 1 ? '' : 's'} detected
      </div>

      <ul className="space-y-1.5">
        {pendingBatchConfirmation.map((write, index) => (
          <li
            key={`${write.tableColumnId}-${write.rowKey ?? 'unresolved'}-${index}`}
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
              write.confidenceRoute === 'auto' &&
                'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
              write.confidenceRoute === 'disambiguate' &&
                'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
              (write.confidenceRoute === 'unresolved' || write.confidenceRoute === 'parse_error') &&
                'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            )}
          >
            <div className="flex flex-col">
              <span className="font-medium">
                {write.entity ?? write.entityMatch?.original ?? 'Unknown entity'}
                {' → '}
                {write.rawValueText}
              </span>
              {write.confidenceRoute === 'parse_error' && (
                <span className="text-xs">Could not parse this value</span>
              )}
              {write.confidenceRoute === 'unresolved' && (
                <span className="text-xs">No matching row found</span>
              )}
            </div>

            {write.confidenceRoute === 'disambiguate' && write.candidates && write.candidates.length > 0 && (
              <div className="flex gap-1">
                {write.candidates.map((candidate) => (
                  <Button
                    key={candidate.rowKey}
                    size="sm"
                    variant="outline"
                    onClick={() => resolveDisambiguation(index, candidate)}
                  >
                    {candidate.entity}
                  </Button>
                ))}
              </div>
            )}

            {(write.confidenceRoute === 'unresolved' || write.confidenceRoute === 'parse_error') && (
              <Button size="sm" variant="ghost" onClick={() => dismissWrite(index)}>
                Dismiss
              </Button>
            )}
          </li>
        ))}

        {batchOverflowCount > 0 && (
          <li className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            +{batchOverflowCount} value{batchOverflowCount === 1 ? '' : 's'} didn&apos;t fit in this row
          </li>
        )}
      </ul>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={confirmBatch} disabled={resolvedCount === 0}>
          Confirm {resolvedCount} resolved
        </Button>
      </div>
    </div>
  );
}
