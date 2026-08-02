/**
 * VoiceButtonInner Component
 * Memoized, purely declarative renderer for the voice input button.
 * All business logic lives in useVoicePipeline — this component only renders.
 * Visual design mirrors the VoiceOrb component in docs/design/src/App.tsx.
 * Based on: docs/05_VOICE_PIPELINE.md §2.2, §9 and docs/06_SMART_POINTER.md §9
 */

'use client';

import React from 'react';
import { Mic, Infinity as InfinityIcon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVoicePipeline } from '@/lib/client/hooks/voice/use-voice-pipeline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TableSchema } from '@/lib/shared/types/table-schema';

const FOREST = '#13501B';
const FOREST_DARK = '#0d3b14';

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

  const isBusy = isProcessing || isConfirming;
  const isActive = continuousMode || isListening || isCommitting || isAdvancing;

  // Orb fill: black idle, forest green once engaged, red on error — mirrors VoiceOrb's
  // `recording ? '#13501B' : '#000'` binary, extended for this app's richer state machine.
  const orbBackground = isError ? '#dc2626' : isBusy ? '#9ca3af' : isActive ? FOREST : '#000';

  return (
    <TooltipProvider>
      <div className="relative flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative flex items-center justify-center w-20 h-20 select-none">
              {/* Expanding pulse rings — identical timing/opacity to the Figma VoiceOrb */}
              {isListening && (
                <>
                  <span
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: FOREST, opacity: 0.15, animation: 'pulse-ring 1.4s ease-out infinite' }}
                  />
                  <span
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: FOREST, opacity: 0.1, animation: 'pulse-ring 1.4s ease-out 0.5s infinite' }}
                  />
                </>
              )}

              <motion.button
                type="button"
                className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border-0 disabled:cursor-not-allowed"
                style={{
                  background: orbBackground,
                  boxShadow: isListening
                    ? `0 0 0 3px rgba(19,80,27,0.3)`
                    : '0 4px 24px rgba(0,0,0,0.18)',
                }}
                onClick={handleToggle}
                disabled={isBusy}
                aria-label={continuousMode ? 'Stop continuous mode' : 'Start continuous mode'}
                whileHover={{ scale: isBusy ? 1 : 1.05 }}
                whileTap={{ scale: isBusy ? 1 : 0.95 }}
                animate={{ scale: isListening ? 1.07 : 1 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                {isBusy ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : continuousMode ? (
                  <InfinityIcon className="h-6 w-6 text-white" />
                ) : (
                  <Mic className="h-6 w-6 text-white" fill={isListening ? '#fff' : 'none'} />
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
              className="h-full"
              style={{ background: FOREST }}
              animate={{
                width: `${Math.max(40, visualLevel * 100)}%`,
                opacity: [0.6, 1],
              }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Status text */}
        <div className="text-xs font-medium text-center" style={{ color: isError ? '#dc2626' : '#6b7280' }}>
          {continuousMode ? (
            <>
              {isListening && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full animate-pulse"
                    style={{ background: FOREST }}
                  />
                  <span style={{ color: FOREST_DARK }}>Listening for speech...</span>
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
              <div className="text-xs text-gray-400 mt-1">Press Esc to stop</div>
            </>
          ) : (
            'Tap to activate continuous'
          )}
        </div>
      </div>
    </TooltipProvider>
  );
});
