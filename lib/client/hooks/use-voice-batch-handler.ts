/**
 * useVoiceBatchHandler Hook
 * Handles multi-entity batch voice results: surfaces them for confirmation,
 * commits resolved writes in one transaction, and advances the pointer once
 * per committed write.
 * Based on: docs/features/03_ai_table_agent.md §5
 */

import { useCallback } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
import type { BatchCellWrite, VoiceBatchResult } from '@/lib/shared/types/voice-pipeline';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { CellPosition } from '@/lib/client/stores/ui-store';
import { navigationStrategies } from '@/lib/client/navigation/strategies';

interface UseVoiceBatchHandlerOptions {
  tableId: string;
  tableSchema: TableSchema;
  onEndOfTable?: () => void;
}

interface VoiceBatchHandlerResult {
  /** Surfaces a batch result for confirmation (sets recordingState to 'confirming'). */
  handleBatchResult: (result: VoiceBatchResult) => void;
  /** Commits every currently-resolved write (route 'auto') in one transaction, then advances the pointer. */
  confirmBatch: () => Promise<void>;
  /** User tapped a disambiguation candidate — resolves that entry to 'auto'. */
  resolveDisambiguation: (index: number, candidate: { entity: string; rowKey: string }) => void;
  /** User dismissed an unresolved/parse_error entry without committing it. */
  dismissWrite: (index: number) => void;
}

export function useVoiceBatchHandler({
  tableId,
  tableSchema,
  onEndOfTable,
}: UseVoiceBatchHandlerOptions): VoiceBatchHandlerResult {
  const setRecordingState = useUIStore((s) => s.setRecordingState);
  const setPendingBatchConfirmation = useUIStore((s) => s.setPendingBatchConfirmation);
  const updateBatchWrite = useUIStore((s) => s.updateBatchWrite);
  const removeBatchWrite = useUIStore((s) => s.removeBatchWrite);
  const setActiveCell = useUIStore((s) => s.setActiveCell);
  const setContinuousMode = useUIStore((s) => s.setContinuousMode);
  const setError = useUIStore((s) => s.setError);

  const updateCellsBatch = useTableCellStore((s) => s.updateCellsBatch);

  const handleBatchResult = useCallback(
    (result: VoiceBatchResult) => {
      setPendingBatchConfirmation(result.writes, result.overflowCount);
      setRecordingState('confirming');
    },
    [setPendingBatchConfirmation, setRecordingState]
  );

  const resolveDisambiguation = useCallback(
    (index: number, candidate: { entity: string; rowKey: string }) => {
      const { pendingBatchConfirmation } = useUIStore.getState();
      const current = pendingBatchConfirmation?.[index];
      if (!current) return;

      const resolved: BatchCellWrite = {
        ...current,
        rowKey: candidate.rowKey,
        entity: candidate.entity,
        confidenceRoute: 'auto',
      };
      updateBatchWrite(index, resolved);
    },
    [updateBatchWrite]
  );

  const dismissWrite = useCallback(
    (index: number) => {
      removeBatchWrite(index);
    },
    [removeBatchWrite]
  );

  const confirmBatch = useCallback(async () => {
    const { pendingBatchConfirmation, activeCell, navigationMode, continuousMode } =
      useUIStore.getState();

    if (!pendingBatchConfirmation || !activeCell) {
      setPendingBatchConfirmation(null);
      setRecordingState('idle');
      return;
    }

    const committable = pendingBatchConfirmation.filter(
      (w): w is BatchCellWrite & { rowKey: string } =>
        w.confidenceRoute === 'auto' && w.valueValid && w.rowKey !== null
    );

    if (committable.length === 0) {
      setPendingBatchConfirmation(null);
      setRecordingState('idle');
      return;
    }

    try {
      setRecordingState('committing');

      await updateCellsBatch(
        tableId,
        committable.map((w) => ({
          rowKey: w.rowKey,
          tableColumnId: w.tableColumnId,
          value: w.value as string | number | boolean | null,
        }))
      );

      // Advance the pointer once per committed write, starting from the cell
      // active before this batch — lands one past the last write.
      // docs/features/03_ai_table_agent.md §5.5
      const strategy = navigationStrategies[navigationMode];
      const rowIndexMap = new Map(tableSchema.rows.map((r, i) => [r.id, i]));
      const colIndexMap = new Map(tableSchema.columns.map((c, i) => [c.id, i]));

      let nextCell: CellPosition | null = activeCell;
      for (let i = 0; i < committable.length; i++) {
        if (!nextCell) break;
        nextCell = strategy.getNext(nextCell, tableSchema, rowIndexMap, colIndexMap);
      }

      setPendingBatchConfirmation(null);

      if (nextCell) {
        setActiveCell(nextCell);
        setRecordingState('advancing');
      } else {
        if (continuousMode) {
          setContinuousMode(false);
          onEndOfTable?.();
        }
        setRecordingState('idle');
      }
    } catch (error) {
      console.error('[useVoiceBatchHandler] Batch commit failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to save batch entry');
    }
  }, [
    tableId,
    tableSchema,
    updateCellsBatch,
    setPendingBatchConfirmation,
    setRecordingState,
    setActiveCell,
    setContinuousMode,
    setError,
    onEndOfTable,
  ]);

  return { handleBatchResult, confirmBatch, resolveDisambiguation, dismissWrite };
}
