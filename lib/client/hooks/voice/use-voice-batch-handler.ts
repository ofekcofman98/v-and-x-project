/**
 * useVoiceBatchHandler Hook
 * Handles multi-entity batch voice results: surfaces them for confirmation,
 * commits resolved writes in one transaction, and advances the pointer once
 * per committed write.
 * Based on: docs/features/03_ai_table_agent.md §5
 */

import { useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
import { voiceTelemetry } from '@/lib/client/hooks/voice/use-voice-telemetry';
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
  /**
   * Surfaces a batch result for confirmation (sets recordingState to 'confirming').
   * requestId identifies this interaction for docs/features/19_voice_telemetry.md.
   */
  handleBatchResult: (result: VoiceBatchResult, requestId?: string) => void;
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

  // Holds the pending auto-commit timer (see handleBatchResult below) so it
  // can be cleared on unmount. No cancellation is needed on manual
  // confirm/cancel — confirmBatch is a no-op once pendingBatchConfirmation
  // is null, so a stale timer firing late is harmless.
  const autoCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoCommitTimerRef.current) {
        clearTimeout(autoCommitTimerRef.current);
      }
    };
  }, []);

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
    const { pendingBatchConfirmation, pendingBatchRequestId, activeCell, navigationMode, continuousMode } =
      useUIStore.getState();

    // docs/features/19_voice_telemetry.md §7 — confirm_received_at (whether
    // triggered by the auto-commit timer or a manual "Confirm" click).
    if (pendingBatchRequestId) {
      voiceTelemetry.mark(pendingBatchRequestId, 'confirmReceivedAt');
    }

    if (!pendingBatchConfirmation || !activeCell) {
      if (pendingBatchRequestId) {
        voiceTelemetry.setConfirmationRoute(pendingBatchRequestId, 'abandoned');
        voiceTelemetry.flush(pendingBatchRequestId);
      }
      setPendingBatchConfirmation(null);
      setRecordingState('idle');
      return;
    }

    const committable = pendingBatchConfirmation.filter(
      (w): w is BatchCellWrite & { rowKey: string } =>
        w.confidenceRoute === 'auto' && w.valueValid && w.rowKey !== null
    );

    if (committable.length === 0) {
      if (pendingBatchRequestId) {
        voiceTelemetry.setConfirmationRoute(pendingBatchRequestId, 'abandoned');
        voiceTelemetry.flush(pendingBatchRequestId);
      }
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
        })),
        pendingBatchRequestId ?? undefined
      );

      // Pointer re-targeting after commit. Entity-first re-targets to the
      // last resolved entity's row at the utterance's starting column
      // ("the teacher moves to the next student") — a different shape than
      // the generic per-write walk below, since every entity-first group
      // re-names its own row rather than advancing linearly through cells.
      // docs/features/18_entity_first_navigation.md §7
      let nextCell: CellPosition | null;
      if (navigationMode === 'entity-first') {
        const lastWrite = committable[committable.length - 1];
        nextCell = { rowKey: lastWrite.rowKey, tableColumnId: activeCell.tableColumnId };
      } else {
        // Advance the pointer once per committed write, starting from the
        // cell active before this batch — lands one past the last write.
        // docs/features/03_ai_table_agent.md §5.5
        const strategy = navigationStrategies[navigationMode];
        const rowIndexMap = new Map(tableSchema.rows.map((r, i) => [r.id, i]));
        const colIndexMap = new Map(tableSchema.columns.map((c, i) => [c.id, i]));

        nextCell = activeCell;
        for (let i = 0; i < committable.length; i++) {
          if (!nextCell) break;
          nextCell = strategy.getNext(nextCell, tableSchema, rowIndexMap, colIndexMap);
        }
      }

      // Partial-commit semantics (docs/features/03_ai_table_agent.md §5.3):
      // committing the resolved entries must not discard entries still
      // awaiting disambiguation/dismissal — only clear the pending batch
      // once nothing committable remains in it.
      const remaining = pendingBatchConfirmation.filter(
        (w) => !committable.includes(w as BatchCellWrite & { rowKey: string })
      );

      if (remaining.length > 0) {
        // Interaction not done yet — more commits expected for this same
        // requestId, so don't finalize confirmation_route / flush yet.
        setPendingBatchConfirmation(remaining, undefined, pendingBatchRequestId ?? undefined);
        setRecordingState('confirming');
        return;
      }

      // docs/features/19_voice_telemetry.md §7, §12 — everything committable
      // is written; this requestId's interaction is complete.
      if (pendingBatchRequestId) {
        voiceTelemetry.setConfirmationRoute(pendingBatchRequestId, 'batch');
        voiceTelemetry.flush(pendingBatchRequestId);
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

  const handleBatchResult = useCallback(
    (result: VoiceBatchResult, requestId?: string) => {
      setPendingBatchConfirmation(result.writes, result.overflowCount, requestId);
      setRecordingState('confirming');

      // Auto-commit whenever at least one entry resolved ('auto') — resolved
      // entries must not wait on unresolved ones (docs/features/03_ai_table_
      // agent.md §5.3, "partial-commit semantics"). confirmBatch only clears
      // the pending batch once nothing committable remains in it, so any
      // entries the user later resolves manually (disambiguation, edits)
      // stay visible for the explicit "Confirm N resolved" action rather
      // than being swept up retroactively by this timer.
      const hasResolvedEntry = result.writes.some((w) => w.confidenceRoute === 'auto');

      if (autoCommitTimerRef.current) {
        clearTimeout(autoCommitTimerRef.current);
        autoCommitTimerRef.current = null;
      }

      if (hasResolvedEntry) {
        const { autoAdvanceDelay } = useUIStore.getState().preferences;
        autoCommitTimerRef.current = setTimeout(() => {
          autoCommitTimerRef.current = null;
          void confirmBatch();
        }, autoAdvanceDelay);
      }
    },
    [setPendingBatchConfirmation, setRecordingState, confirmBatch]
  );

  return { handleBatchResult, confirmBatch, resolveDisambiguation, dismissWrite };
}
