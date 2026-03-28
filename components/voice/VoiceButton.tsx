/**
 * VoiceButton Component
 * Toggle button for continuous mode or press-and-hold for manual mode
 * Based on: docs/05_VOICE_PIPELINE.md §2.2, §9 and docs/06_SMART_POINTER.md §9
 */ 

'use client';

import { useEffect, useRef } from 'react';
import { Mic, Infinity as InfinityIcon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVoiceEntry } from '@/lib/hooks/use-voice-entry';
import { useContinuousVoice } from '@/lib/hooks/use-continuous-voice';
import { useVoiceActionHandler } from '@/lib/hooks/use-voice-action-handler';
import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ParsedResult } from '@/lib/types/voice-pipeline';
import type { TableSchema } from '@/lib/types/table-schema';
import { VoiceErrors, VoiceInputError } from '@/lib/types/voice-errors';
import { trackVoiceMetrics } from '@/lib/monitoring/voice-metrics';

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
  const continuousMode = useUIStore((state) => state.continuousMode);
  const setContinuousMode = useUIStore((state) => state.setContinuousMode);

  // Track if we're in the advancing state to trigger auto-restart
  const autoRestartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopContinuousRef = useRef<(() => void) | null>(null);

  // Use the new voice action handler hook
  const { handleParsedResult } = useVoiceActionHandler({
    tableSchema,
    onEndOfTable: () => {
      // Stop continuous mode when end of table is reached
      if (stopContinuousRef.current) {
        stopContinuousRef.current();
      }
    },
  });

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
  const { startContinuous, stopContinuous, volume: continuousAudioLevel } =
    useContinuousVoice({
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

  const currentDisplayLevel = continuousMode ? continuousAudioLevel : audioLevel;
  const visualLevel = Math.max(0, Math.min(1, currentDisplayLevel ?? 0));

  // Generate tooltip text based on state
  const getTooltipText = () => {
    if (isProcessing || isConfirming) return 'Processing...';
    if (continuousMode) return 'Continuous mode active - Press ESC to stop';
    return 'Click to activate continuous mode';
  };

  return (
    <TooltipProvider>
      <div className="relative flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              {/* Audio visualizer ring - scales based on audioLevel */}
              {isListening && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/70 to-lime-400/30 pointer-events-none"
                  animate={{
                    scale: [1, 1 + visualLevel * 0.8, 1 + visualLevel * 0.6],
                    opacity: [0.7, 0.35, 0.5],
                  }}
                  transition={{
                    duration: 0.6,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    repeatType: 'reverse',
                  }}
                  style={{
                    transform: 'translate(-50%, -50%)',
                    left: '50%',
                    top: '50%',
                  }}
                />
              )}

              {/* Main button with Framer Motion */}
              <motion.button
                type="button"
                className={cn(
                  'relative rounded-full p-6 transition-all duration-200',
                  'focus:outline-none focus:ring-4 focus:ring-offset-2',
                  'shadow-lg hover:shadow-xl',
                  {
                    'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300': !continuousMode && !isError,
                    'bg-green-500 hover:bg-green-600 focus:ring-green-300': 
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
                whileHover={{ scale: isProcessing || isConfirming ? 1 : 1.05 }}
                whileTap={{ scale: isProcessing || isConfirming ? 1 : 0.95 }}
                animate={
                  isListening 
                    ? { scale: [1, 1.05, 1] }
                    : { scale: 1 }
                }
                transition={{
                  duration: 0.3,
                  ease: 'easeInOut',
                }}
              >
                {/* Show spinning loader when processing */}
                {isProcessing || isConfirming ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : continuousMode ? (
                  <InfinityIcon className="h-6 w-6 text-white" />
                ) : (
                  <Mic className="h-6 w-6 text-white" />
                )}

                {/* Subtle pulse ring when listening for speech */}
                {isListening && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-white/30"
                    animate={{
                      scale: [1, 1.3],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                )}
              </motion.button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipText()}</p>
          </TooltipContent>
        </Tooltip>

      {/* Visual progress bar when listening */}
      {isListening && (
        <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500/80 to-lime-400 shadow-[0_0_20px_rgba(74,222,128,0.6)]"
            animate={{
              width: `${Math.max(40, visualLevel * 100)}%`,
              opacity: [0.6, 1],
            }}
            transition={{
              duration: 0.15,
              ease: 'easeOut',
            }}
          />
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
    </TooltipProvider>
  );
}
