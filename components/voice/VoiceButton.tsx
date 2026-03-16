/**
 * VoiceButton Component
 * Toggle button for continuous mode or press-and-hold for manual mode
 * Based on: docs/05_VOICE_PIPELINE.md §2.2, §9 and docs/06_SMART_POINTER.md §9
 */ 

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { Mic, Square, Infinity } from 'lucide-react';
import Fuse from 'fuse.js';
import { useVoiceEntry } from '@/lib/hooks/use-voice-entry';
import { useContinuousVoice } from '@/lib/hooks/use-continuous-voice';
import { useUIStore } from '@/lib/stores/ui-store';
import { useTableDataStore } from '@/lib/stores/table-data-store';
import { cn } from '@/lib/utils/cn';
import type { ParsedResult } from '@/lib/types/voice-pipeline';
import type { TableSchema } from '@/lib/types/table-schema';
import { VoiceErrors, VoiceInputError } from '@/lib/types/voice-errors';
import { trackVoiceMetrics } from '@/lib/monitoring/voice-metrics';
import { getNextCellColumnFirst } from '@/lib/navigation/column-first';
import { getNextCellRowFirst } from '@/lib/navigation/row-first';

interface VoiceButtonProps {
  tableSchema: TableSchema;
}

export function VoiceButton({ tableSchema }: VoiceButtonProps) {
  const setRecordingState = useUIStore((state) => state.setRecordingState);
  const setPendingConfirmation = useUIStore((state) => state.setPendingConfirmation);
  const setError = useUIStore((state) => state.setError);
  const recordingState = useUIStore((state) => state.recordingState);
  const activeCell = useUIStore((state) => state.activeCell);
  const navigationMode = useUIStore((state) => state.navigationMode);
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const continuousMode = useUIStore((state) => state.continuousMode);
  const setContinuousMode = useUIStore((state) => state.setContinuousMode);
  
  const updateCell = useTableDataStore((state) => state.updateCell);

  // Track if we're in the advancing state to trigger auto-restart
  const autoRestartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopContinuousRef = useRef<(() => void) | null>(null);

  /**
   * Calculate the next cell based on the current navigation mode
   */
  const calculateNextCell = useCallback((currentCell: typeof activeCell) => {
    if (!currentCell) return null;

    const nextCell = navigationMode === 'column-first'
      ? getNextCellColumnFirst(currentCell, tableSchema)
      : getNextCellRowFirst(currentCell, tableSchema);

    return nextCell;
  }, [navigationMode, tableSchema]);

  /**
   * Perform fuzzy matching on entity names
   */
  const performFuzzyMatch = useCallback((rawEntity: string, rows: typeof tableSchema.rows) => {
    if (!rawEntity || rows.length === 0) {
      return null;
    }

    const fuse = new Fuse(rows, {
      keys: ['label'],
      threshold: 0.4,
      includeScore: true,
    });

    const results = fuse.search(rawEntity);

    if (results.length === 0) {
      return null;
    }

    const bestMatch = results[0];
    const confidence = 1 - (bestMatch.score ?? 1);

    return {
      matched: bestMatch.item.label,
      confidence,
      alternatives: results.slice(1, 4).map((result) => ({
        label: result.item.label,
        confidence: 1 - (result.score ?? 1),
      })),
    };
  }, [tableSchema.rows]);

  /**
   * Handle parsed voice result - processes entity/value and either auto-confirms or shows dialog
   */
  const handleParsedResult = useCallback(async (parsed: ParsedResult) => {
    // Perform local fuzzy matching
    let finalEntity = parsed.entity ?? '';
    let finalConfidence = parsed.entityMatch?.confidence ?? 0;
    let alternatives = parsed.alternatives?.map((alt) => ({
      label: alt.entity,
      value: alt.entity,
    }));

    if (parsed.entity) {
      const fuzzyMatch = performFuzzyMatch(parsed.entity, tableSchema.rows);
      
      if (fuzzyMatch) {
        finalEntity = fuzzyMatch.matched;
        finalConfidence = fuzzyMatch.confidence;
        
        if (fuzzyMatch.alternatives.length > 0) {
          alternatives = fuzzyMatch.alternatives.map((alt) => ({
            label: alt.label,
            value: alt.label,
          }));
        }
      }
    }

    // Auto-confirm if confidence is high (> 0.8)
    if (finalConfidence > 0.8) {
      const matchedRow = tableSchema.rows.find((row) => row.label === finalEntity);

      if (!matchedRow || !activeCell) {
        throw new VoiceInputError('UPDATE_FAILED', 'Could not match entity to table row', true);
      }

      // CRITICAL FIX 1: Sync pointer to matched entity BEFORE updating cell
      // This prevents out-of-order desync when user says "Student E, 90" while pointer is on Student A
      const matchedCell: typeof activeCell = {
        rowId: matchedRow.id,
        columnId: activeCell.columnId,
      };

      // Update UI store to point at the actually matched cell
      setActiveCell(matchedCell);
      console.log('[VoiceButton] Synced pointer to matched entity:', matchedCell);

      // Now update the cell value at the matched location
      updateCell(matchedRow.id, activeCell.columnId, parsed.value as string | number | boolean | null);
      setRecordingState('committing');

      // CRITICAL FIX 2: Calculate next cell from the MATCHED cell, not the old activeCell
      // This ensures we advance from the correct position
      const nextCell = calculateNextCell(matchedCell);

      if (nextCell) {
        // Advance to next cell after short delay (green flash animation)
        setTimeout(() => {
          // CRITICAL FIX 3: Read fresh state from store to avoid stale closures
          const currentContinuousMode = useUIStore.getState().continuousMode;
          
          setActiveCell(nextCell);
          console.log('[VoiceButton] Advanced pointer to:', nextCell);
          setRecordingState('advancing');
        }, 500);
      } else {
        // End of table - stop continuous mode if active
        console.log('[VoiceButton] End of table reached');
        if (continuousMode) {
          console.log('[VoiceButton] Stopping continuous mode automatically');
          if (stopContinuousRef.current) {
            stopContinuousRef.current();
          }
          setContinuousMode(false);
        }
        setRecordingState('idle');
      }
    } else {
      // Low confidence - manual confirmation
      setPendingConfirmation({
        entity: finalEntity,
        value: parsed.value as string | number | boolean | null,
        confidence: finalConfidence,
        alternatives,
      });

      setRecordingState('confirming');
    }
  }, [activeCell, calculateNextCell, continuousMode, performFuzzyMatch, setActiveCell, setContinuousMode, setPendingConfirmation, setRecordingState, tableSchema.rows, updateCell]);

  /**
   * Process voice entry through the API (for manual mode)
   */
  const processVoiceEntry = async (audioBlob: Blob) => {
    if (!activeCell) {
      throw VoiceErrors.NO_CELL_SELECTED;
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('tableSchema', JSON.stringify(tableSchema));
    formData.append('activeCell', JSON.stringify(activeCell));
    formData.append('navigationMode', navigationMode);

    const startTime = Date.now();
    const response = await fetch('/api/voice-entry', {
      method: 'POST',
      body: formData,
    });

    const duration = Date.now() - startTime;
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      const errorCode = payload.error?.code ?? 'VOICE_ENTRY_FAILED';
      const errorMessage = payload.error?.message ?? 'Voice entry failed';

      trackVoiceMetrics({ phase: 'voice-entry', duration, success: false, error: errorMessage });

      if (response.status === 429) {
        throw VoiceErrors.STT_RATE_LIMIT;
      }

      throw new VoiceInputError(errorCode, errorMessage, true);
    }

    const parsed: ParsedResult = payload.data;

    if (parsed.action === 'AMBIGUOUS') {
      trackVoiceMetrics({ phase: 'voice-entry', duration, success: false, error: 'Ambiguous match' });
      throw VoiceErrors.PARSE_AMBIGUOUS;
    }

    if (parsed.action === 'ERROR' || !parsed.valueValid) {
      trackVoiceMetrics({ phase: 'voice-entry', duration, success: false, error: parsed.error ?? 'Invalid value' });

      if (!parsed.entity) {
        throw VoiceErrors.PARSE_NO_MATCH;
      }
      if (!parsed.valueValid) {
        throw VoiceErrors.PARSE_INVALID_VALUE;
      }
      throw new VoiceInputError('PARSE_ERROR', parsed.error ?? parsed.reasoning ?? 'Could not parse command', true);
    }

    trackVoiceMetrics({ phase: 'voice-entry', duration, success: true });

    await handleParsedResult(parsed);
  };

  /**
   * Handle audio ready from manual recording
   */
  const handleAudioReady = async (audioBlob: Blob) => {
    setPendingConfirmation(null);
    setRecordingState('processing');
    
    const totalStartTime = Date.now();
    
    try {
      await processVoiceEntry(audioBlob);
      
      const totalDuration = Date.now() - totalStartTime;
      trackVoiceMetrics({ phase: 'total', duration: totalDuration, success: true });
    } catch (error) {
      const totalDuration = Date.now() - totalStartTime;
      
      if (error instanceof VoiceInputError) {
        trackVoiceMetrics({ phase: 'total', duration: totalDuration, success: false, error: error.code });
      } else {
        trackVoiceMetrics({ phase: 'total', duration: totalDuration, success: false, error: 'Unknown error' });
      }
      
      setPendingConfirmation(null);
      setError();
    }
  };

  /**
   * Handle voice recording errors
   */
  const handleVoiceError = (error: unknown) => {
    console.error('Recording error:', error);
    setPendingConfirmation(null);
    setError();
  };

  // Manual recording hook (press-and-hold)
  const {
    isRecording,
    audioLevel,
    startRecording: startRecordingHook,
    stopRecording: stopRecordingHook,
  } = useVoiceEntry({
    onAudioReady: handleAudioReady,
    onError: handleVoiceError,
  });

  // Continuous mode hook (VAD-based)
  const { startContinuous, stopContinuous } = useContinuousVoice({
    tableSchema,
    onResult: handleParsedResult,
    onError: handleVoiceError,
  });

  // Store stopContinuous in ref so handleParsedResult can access it
  useEffect(() => {
    stopContinuousRef.current = stopContinuous;
  }, [stopContinuous]);

  /**
   * Auto-restart logic for continuous mode
   * When advancing state is reached and continuous mode is active, auto-restart listening
   * CRITICAL: Uses fresh store state to avoid stale closures causing infinite loops
   */
  useEffect(() => {
    if (recordingState === 'advancing') {
      // Clear any existing timer
      if (autoRestartTimerRef.current) {
        clearTimeout(autoRestartTimerRef.current);
        autoRestartTimerRef.current = null;
      }

      // CRITICAL FIX 4: Read fresh state from store at execution time
      // Wait 400ms to show green flash, then check if continuous mode is still active
      autoRestartTimerRef.current = setTimeout(() => {
        const freshState = useUIStore.getState();
        
        // Only restart if continuous mode is still active and we're still advancing
        if (freshState.continuousMode && freshState.recordingState === 'advancing') {
          console.log('[VoiceButton] Auto-restarting listening after pointer advance');
          setRecordingState('listening');
        } else {
          console.log('[VoiceButton] Skipping auto-restart - continuous mode inactive or state changed');
        }
        
        autoRestartTimerRef.current = null;
      }, 400);
    }

    return () => {
      if (autoRestartTimerRef.current) {
        clearTimeout(autoRestartTimerRef.current);
        autoRestartTimerRef.current = null;
      }
    };
  }, [recordingState, setRecordingState]);

  /**
   * Handle Escape key to stop continuous mode
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && continuousMode) {
        e.preventDefault();
        stopContinuous();
        setContinuousMode(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [continuousMode, stopContinuous, setContinuousMode]);

  /**
   * Toggle continuous mode
   */
  const handleToggle = async () => {
    if (continuousMode) {
      stopContinuous();
      setContinuousMode(false);
    } else {
      setContinuousMode(true);
      await startContinuous();
    }
  };

  const isListening = continuousMode && recordingState === 'listening';
  const isProcessing = recordingState === 'processing';
  const isError = recordingState === 'error';
  const isConfirming = recordingState === 'confirming';
  const isCommitting = recordingState === 'committing';
  const isAdvancing = recordingState === 'advancing';

  return (
    <div className="relative flex flex-col items-center gap-2">
      <button
        type="button"
        className={cn(
          'relative rounded-full p-6 transition-all duration-200',
          'focus:outline-none focus:ring-4 focus:ring-offset-2',
          'shadow-lg hover:shadow-xl',
          {
            'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300': !continuousMode && !isError,
            'bg-green-500 hover:bg-green-600 focus:ring-green-300 animate-pulse': 
              continuousMode && isListening,
            'bg-green-600': continuousMode && !isListening && !isError && !isProcessing && !isConfirming,
            'bg-gray-400 cursor-not-allowed': isProcessing || isConfirming,
            'bg-emerald-500': isCommitting || isAdvancing,
            'bg-red-600': isError,
          }
        )}
        onClick={handleToggle}
        disabled={isProcessing || isConfirming}
        aria-label={continuousMode ? 'Stop continuous mode' : 'Start continuous mode'}
      >
        {continuousMode ? (
          <Infinity className="h-6 w-6 text-white" />
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}

        {/* Subtle pulse ring when listening for speech */}
        {isListening && (
          <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
        )}
      </button>

      {/* Visual progress bar when listening */}
      {isListening && (
        <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 animate-pulse" style={{ width: '100%' }} />
        </div>
      )}

      {/* Status text */}
      <div className="text-xs text-gray-600 dark:text-gray-400 font-medium text-center">
        {continuousMode ? (
          <>
            {isListening && (
              <div className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span>Listening for speech...</span>
              </div>
            )}
            {isProcessing && 'Processing...'}
            {isConfirming && 'Confirm entry'}
            {isCommitting && 'Saving...'}
            {isAdvancing && 'Advancing...'}
            {isError && 'Error occurred'}
            {!isListening && !isProcessing && !isConfirming && !isError && !isCommitting && !isAdvancing && 
              'Continuous Active'}
            <div className="text-xs text-gray-500 mt-1">Press Esc to stop</div>
          </>
        ) : (
          'Tap to activate continuous'
        )}
      </div>
    </div>
  );
}
