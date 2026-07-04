/**
 * VoiceButtonInner Component
 * Memoized, purely declarative renderer for the voice input button.
 * All business logic lives in useVoicePipeline — this component only renders.
 * Based on: docs/05_VOICE_PIPELINE.md §2.2, §9 and docs/06_SMART_POINTER.md §9
 */

'use client';

import React from 'react';
import { Mic, Infinity as InfinityIcon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVoicePipeline } from '@/lib/client/hooks/use-voice-pipeline';
import { cn } from '@/lib/shared/utils/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TableSchema } from '@/lib/shared/types/table-schema';

interface VoiceButtonInnerProps {
  tableId: string;
  tableSchema: TableSchema;
  /**
   * Primitive boolean derived by VoiceButtonShell.
   * Changing from null → non-null (or vice versa) triggers a re-render;
   * row-to-row cell navigation does not.
   */
  hasActiveCell: boolean;
}

export const VoiceButtonInner = React.memo(function VoiceButtonInner({
  tableId,
  tableSchema,
  hasActiveCell,
}: VoiceButtonInnerProps): React.JSX.Element {
  const {
    isListening,
    isProcessing,
    isConfirming,
    isCommitting,
    isAdvancing,
    isError,
    continuousMode,
    visualLevel,
    handleToggle,
    tooltipText,
  } = useVoicePipeline({ tableId, tableSchema, hasActiveCell });

  return (
    <TooltipProvider>
      <div className="relative flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              {/* Audio visualizer ring — scales with audioLevel while listening */}
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
                    'bg-green-600':
                      continuousMode && !isListening && !isError && !isProcessing && !isConfirming,
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
                animate={isListening ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                {isProcessing || isConfirming ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : continuousMode ? (
                  <InfinityIcon className="h-6 w-6 text-white" />
                ) : (
                  <Mic className="h-6 w-6 text-white" />
                )}

                {/* Subtle pulse ring while listening */}
                {isListening && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-white/30"
                    animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
              </motion.button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>

        {/* Visual progress bar while listening */}
        {isListening && (
          <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500/80 to-lime-400 shadow-[0_0_20px_rgba(74,222,128,0.6)]"
              animate={{
                width: `${Math.max(40, visualLevel * 100)}%`,
                opacity: [0.6, 1],
              }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
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
              {!isListening &&
                !isProcessing &&
                !isConfirming &&
                !isError &&
                !isCommitting &&
                !isAdvancing &&
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
});
