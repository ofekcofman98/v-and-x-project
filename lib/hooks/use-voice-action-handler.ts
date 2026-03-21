/**
 * useVoiceActionHandler Hook
 * Handles parsed voice results: entity matching, cell updates, and pointer advancement
 * Extracted from VoiceButton to separate concerns and integrate cascading matcher
 * Based on: docs/05_VOICE_PIPELINE.md §2.2 and docs/06_SMART_POINTER.md
 */

import { useCallback, useEffect } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTableDataStore } from '@/lib/stores/table-data-store';
import { match } from '@/lib/matching/matcher';
import { detectAmbiguity } from '@/lib/matching/ambiguity';
import { getNextCellColumnFirst } from '@/lib/navigation/column-first';
import { getNextCellRowFirst } from '@/lib/navigation/row-first';
import { VoiceInputError } from '@/lib/types/voice-errors';
import { warmEntityCache } from '@/lib/matching/cache';
import type { ParsedResult } from '@/lib/types/voice-pipeline';
import type { TableSchema } from '@/lib/types/table-schema';
import type { CellPosition } from '@/lib/stores/ui-store';

interface UseVoiceActionHandlerOptions {
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
  tableSchema,
  onEndOfTable,
}: UseVoiceActionHandlerOptions): VoiceActionHandlerResult {
  const setRecordingState = useUIStore((state) => state.setRecordingState);
  const setPendingConfirmation = useUIStore((state) => state.setPendingConfirmation);
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const activeCell = useUIStore((state) => state.activeCell);
  const navigationMode = useUIStore((state) => state.navigationMode);
  const continuousMode = useUIStore((state) => state.continuousMode);
  const setContinuousMode = useUIStore((state) => state.setContinuousMode);
  
  const updateCell = useTableDataStore((state) => state.updateCell);

  /**
   * Proactive Cache Warming
   * Pre-populate the EntityRecognitionCache with all existing student names
   * from the table schema to avoid any LLM parsing for known entities.
   * 
   * Runs on hook initialization and whenever tableSchema.rows change
   */
  useEffect(() => {
    if (tableSchema.rows.length > 0) {
      warmEntityCache(tableSchema.rows);
    }
  }, [tableSchema.rows]);

  /**
   * Calculate the next cell based on the current navigation mode
   */
  const calculateNextCell = useCallback(
    (currentCell: CellPosition | null): CellPosition | null => {
      if (!currentCell) return null;

      const nextCell = navigationMode === 'column-first'
        ? getNextCellColumnFirst(currentCell, tableSchema)
        : getNextCellRowFirst(currentCell, tableSchema);

      return nextCell;
    },
    [navigationMode, tableSchema]
  );

  /**
   * Handle parsed voice result
   * Uses cascading matcher to find best entity match, then updates cell and advances pointer
   */
  const handleParsedResult = useCallback(
    async (parsed: ParsedResult) => {
      if (!activeCell) {
        throw new VoiceInputError('NO_CELL_SELECTED', 'No cell selected', true);
      }

      // Extract entity names from schema for matching
      const entityNames = tableSchema.rows.map((row) => row.label);

      // Use cascading matcher (Exact → Phonetic → Fuzzy)
      const matchResult = match(parsed.entity ?? '', entityNames, {
        useCache: true,
        usePhonetic: true,
        useFuzzy: true,
        fuzzyThreshold: 2,
      });

      console.log('[VoiceActionHandler] Cascading match result:', {
        input: parsed.entity,
        matched: matchResult.matched,
        confidence: matchResult.confidence,
        matchType: matchResult.matchType,
        candidates: matchResult.candidates,
      });

      // Detect ambiguity using our ambiguity detection system
      const ambiguityResult = detectAmbiguity(matchResult, 0.85);

      console.log('[VoiceActionHandler] Ambiguity analysis:', ambiguityResult);

      // Prepare alternatives for confirmation dialog
      const alternatives = ambiguityResult.candidates.map((candidate) => ({
        label: candidate.entity,
        value: candidate.entity,
      }));

      // Handle based on ambiguity recommendation
      if (ambiguityResult.recommendedAction === 'auto_select' && matchResult.matched) {
        const matchedRow = tableSchema.rows.find(
          (row) => row.label === matchResult.matched
        );

        if (!matchedRow) {
          throw new VoiceInputError(
            'UPDATE_FAILED',
            'Matched entity not found in schema',
            true
          );
        }

        // Sync pointer to matched entity BEFORE updating cell
        // This prevents out-of-order desync when user says "Student E, 90" while pointer is on Student A
        const matchedCell: CellPosition = {
          rowId: matchedRow.id,
          columnId: activeCell.columnId,
        };

        setActiveCell(matchedCell);
        console.log('[VoiceActionHandler] Synced pointer to matched entity:', matchedCell);

        // Update the cell value at the matched location
        updateCell(
          matchedRow.id,
          activeCell.columnId,
          parsed.value as string | number | boolean | null
        );
        setRecordingState('committing');

        // Calculate next cell from the MATCHED cell, not the old activeCell
        const nextCell = calculateNextCell(matchedCell);

        if (nextCell) {
          // Advance to next cell after short delay (green flash animation)
          setTimeout(() => {
            setActiveCell(nextCell);
            console.log('[VoiceActionHandler] Advanced pointer to:', nextCell);
            setRecordingState('advancing');
          }, 500);
        } else {
          // End of table reached
          console.log('[VoiceActionHandler] End of table reached');
          
          // Stop continuous mode if active
          if (continuousMode) {
            console.log('[VoiceActionHandler] Stopping continuous mode automatically');
            setContinuousMode(false);
            onEndOfTable?.();
          }
          
          setRecordingState('idle');
        }
      } else if (ambiguityResult.isAmbiguous || ambiguityResult.recommendedAction === 'ask_user') {
        // Ambiguous match - show confirmation dialog with alternatives
        console.log('[VoiceActionHandler] Ambiguous match detected, showing confirmation with alternatives');

        setPendingConfirmation({
          entity: matchResult.matched ?? parsed.entity ?? '',
          value: parsed.value as string | number | boolean | null,
          confidence: matchResult.confidence,
          alternatives,
        });

        setRecordingState('confirming');
      } else {
        // No match or very low confidence
        console.log('[VoiceActionHandler] No match found or very low confidence');

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
      activeCell,
      tableSchema,
      calculateNextCell,
      continuousMode,
      setActiveCell,
      setContinuousMode,
      setPendingConfirmation,
      setRecordingState,
      updateCell,
      onEndOfTable,
    ]
  );

  return {
    handleParsedResult,
    calculateNextCell,
  };
}
