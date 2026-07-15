/**
 * useVoiceActionHandler Hook
 * Handles parsed voice results: entity matching, cell updates, and pointer advancement
 * Extracted from VoiceButton to separate concerns and integrate cascading matcher
 * Based on: docs/05_VOICE_PIPELINE.md §2.2 and docs/06_SMART_POINTER.md
 */

import { useCallback, useMemo } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
import { detectAmbiguity } from '@/lib/shared/utils/ambiguity';
import { VoiceInputError } from '@/lib/shared/types/voice-errors';
import { toast } from '@/components/ui/use-toast';
import { logger } from '@/lib/shared/logging/client-logger';
import type { ParsedResult } from '@/lib/shared/types/voice-pipeline';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { CellPosition } from '@/lib/client/stores/ui-store';
import { navigationStrategies } from '../navigation/strategies';

interface UseVoiceActionHandlerOptions {
  tableId: string;
  tableSchema: TableSchema;
  onEndOfTable?: () => void;
}

interface VoiceActionHandlerResult {
  handleParsedResult: (parsed: ParsedResult) => Promise<void>;
  calculateNextCell: (currentCell: CellPosition | null) => CellPosition | null;
}

/**
 * Hook for handling voice action results
 * Separates business logic from UI component
 */
export function useVoiceActionHandler({
  tableId,
  tableSchema,
  onEndOfTable,
}: UseVoiceActionHandlerOptions): VoiceActionHandlerResult {
  // Stable action dispatchers — Zustand guarantees these references never change,
  // so these selectors never trigger a re-render.
  const setRecordingState = useUIStore((state) => state.setRecordingState);
  const setPendingConfirmation = useUIStore((state) => state.setPendingConfirmation);
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const setContinuousMode = useUIStore((state) => state.setContinuousMode);

  // activeCell, navigationMode, continuousMode are read imperatively inside callbacks
  // via useUIStore.getState() to avoid re-rendering on every cell-selection change.

  const updateCell = useTableCellStore((state) => state.updateCell);

  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    tableSchema.rows.forEach((row, index) => {
      map.set(row.id, index);
    });
    return map;
  }, [tableSchema.rows]);
  
  const colIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    tableSchema.columns.forEach((col, index) => {
      map.set(col.id, index);
    });
    return map;
  }, [tableSchema.columns]);
  


  /**
   * Calculate the next cell based on the current navigation mode.
   * Reads navigationMode imperatively so the callback is not recreated on preference changes.
   */
  const calculateNextCell = useCallback(
    (currentCell: CellPosition | null): CellPosition | null => {
      if (!currentCell) return null;

      const { navigationMode } = useUIStore.getState();
      const strategy = navigationStrategies[navigationMode];

      return strategy.getNext(currentCell, tableSchema, rowIndexMap, colIndexMap);
    },
    [tableSchema, rowIndexMap, colIndexMap]
  );

  /**
   * Handle parsed voice result.
   * Uses cascading matcher to find best entity match, then updates cell and advances pointer.
   * Reads activeCell and continuousMode imperatively at call time so this callback is stable
   * across all cell-selection changes.
   */
  const handleParsedResult = useCallback(
    async (parsed: ParsedResult) => {
      // Read volatile state imperatively — no stale-closure risk, no re-render on change
      const { activeCell, continuousMode } = useUIStore.getState();

      if (!activeCell) {
        throw new VoiceInputError('NO_CELL_SELECTED', 'No cell selected', true);
      }

      // The entity match was already computed server-side by /api/voice-entry
      // (Levels 1-4 cascading matcher). Just classify ambiguity over that result.
      const matched = parsed.entityMatch?.matched ?? null;
      const confidence = parsed.entityMatch?.confidence ?? 0;
      const candidates = parsed.alternatives ?? [];

      const ambiguityResult = detectAmbiguity(matched, confidence, candidates, 0.85);

      // Prepare alternatives for confirmation dialog
      const alternatives = ambiguityResult.candidates.map((candidate) => ({
        label: candidate.entity,
        value: candidate.entity,
      }));

      // Handle based on ambiguity recommendation
      if (ambiguityResult.recommendedAction === 'auto_select' && matched) {
        const matchedRow = tableSchema.rows.find(
          (row) => row.label === matched
        );

        if (!matchedRow) {
          // The server reported a high-confidence match (e.g. a Whisper
          // mis-transcription like "John 74" -> "1.74" matching itself with
          // confidence 1) for a label that doesn't actually exist in this
          // table's rows. Never let that escape as an unhandled rejection —
          // ask the user to confirm/correct instead, same as a low-confidence
          // match, so continuous mode keeps listening.
          logger.warn('Matched entity not found in schema — asking user to confirm', {
            tableId,
            matched,
          });

          toast({
            title: 'Could not find that entry',
            description: `"${matched}" doesn't match anyone in this table.`,
            variant: 'destructive',
          });

          setPendingConfirmation({
            entity: parsed.entity ?? matched ?? '',
            value: parsed.value as string | number | boolean | null,
            confidence: 0,
            alternatives: [],
          });

          setRecordingState('confirming');
          return;
        }

        // Determine where the data should land before mutating state
        const matchedCell: CellPosition = {
          rowKey: matchedRow.id,
          tableColumnId: activeCell.tableColumnId,
        };

        await updateCell(
          tableId,
          matchedCell.rowKey,
          matchedCell.tableColumnId,
          parsed.value as string | number | boolean | null
        );

        // Sync pointer to matched entity after the write so the UI follows the data
        setActiveCell(matchedCell);
        setRecordingState('committing');

        // Calculate next cell from the MATCHED cell, not the old activeCell
        const nextCell = calculateNextCell(matchedCell);

        if (nextCell) {
          // Advance to next cell after short delay (green flash animation)
          setTimeout(() => {
            setActiveCell(nextCell);
            setRecordingState('advancing');
          }, 500);
        } else {
          // End of table reached — stop continuous mode if active
          if (continuousMode) {
            setContinuousMode(false);
            onEndOfTable?.();
          }

          setRecordingState('idle');
        }
      } else if (ambiguityResult.isAmbiguous || ambiguityResult.recommendedAction === 'ask_user') {
        setPendingConfirmation({
          entity: matched ?? parsed.entity ?? '',
          value: parsed.value as string | number | boolean | null,
          confidence,
          alternatives,
        });

        setRecordingState('confirming');
      } else {
        // No match or very low confidence — show confirmation dialog
        setPendingConfirmation({
          entity: parsed.entity ?? '',
          value: parsed.value as string | number | boolean | null,
          confidence: 0,
          alternatives: [],
        });

        setRecordingState('confirming');
      }
    },
    [
      tableId,
      tableSchema,
      calculateNextCell,
      setActiveCell,
      setContinuousMode,
      setPendingConfirmation,
      setRecordingState,
      updateCell,
      onEndOfTable,
    ]
    // activeCell, navigationMode, continuousMode intentionally omitted —
    // read imperatively via getState() to keep this callback stable.
  );

  return {
    handleParsedResult,
    calculateNextCell,
  };
}
