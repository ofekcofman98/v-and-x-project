/**
 * useVoiceErrorHandler Hook
 * Centralises the voice error dispatch logic: log → set state → toast → reset.
 * Extracted from VoiceButton to eliminate the two identical 60-line error blocks.
 * Based on: docs/09_ERROR_HANDLING.md
 */

import { useCallback } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { VoiceInputError, VocalGridError, ErrorCodes } from '@/lib/shared/types/voice-errors';
import { getErrorMessage } from '@/lib/shared/errors/error-mapping';
import { trackVoiceMetrics } from '@/lib/shared/monitoring/voice-metrics';
import { logger } from '@/lib/shared/logging/client-logger';

export type ErrorPhase = 'recording' | 'voice-entry';

interface UseVoiceErrorHandlerOptions {
  /** Called when a recoverable error's "Try Again" action is clicked */
  onResetToIdle: () => void;
}

interface UseVoiceErrorHandlerReturn {
  /**
   * Log the error, transition UI to 'error' state, show the appropriate toast,
   * then auto-reset to 'idle' after 2 000 ms.
   */
  dispatchError: (
    error: unknown,
    context: { phase: ErrorPhase; durationMs?: number }
  ) => void;
}

export function useVoiceErrorHandler({
  onResetToIdle,
}: UseVoiceErrorHandlerOptions): UseVoiceErrorHandlerReturn {

  const dispatchError = useCallback(
    (error: unknown, context: { phase: ErrorPhase; durationMs?: number }) => {
      const { setRecordingState, setPendingConfirmation } = useUIStore.getState();

      logger.error(
        error instanceof Error ? error : new Error(String(error)),
        { phase: context.phase, duration: context.durationMs }
      );

      setRecordingState('error');
      setPendingConfirmation(null);

      if (error instanceof VocalGridError) {
        trackVoiceMetrics({
          phase: context.phase === 'voice-entry' ? 'total' : 'voice-entry',
          duration: context.durationMs ?? 0,
          success: false,
          error: error.code,
        });

        const errorMapping = getErrorMessage(error.code);

        if (error.isRecoverable) {
          toast({
            title: errorMapping.title,
            description: errorMapping.message,
            variant: 'destructive',
            duration: 5000,
            action: (
              <ToastAction altText="Try again" onClick={onResetToIdle}>
                {errorMapping.action ?? 'Try Again'}
              </ToastAction>
            ),
          });
        } else {
          toast({
            title: errorMapping.title,
            description: errorMapping.message,
            variant: 'destructive',
            duration: 0,
          });
        }
      } else if (error instanceof VoiceInputError) {
        trackVoiceMetrics({
          phase: context.phase === 'voice-entry' ? 'total' : 'voice-entry',
          duration: context.durationMs ?? 0,
          success: false,
          error: error.code,
        });

        const errorMapping = getErrorMessage(error.code);

        if (error.recoverable) {
          toast({
            title: errorMapping.title,
            description: error.message || errorMapping.message,
            variant: 'destructive',
            duration: 5000,
            action: (
              <ToastAction altText="Try again" onClick={onResetToIdle}>
                {errorMapping.action ?? 'Try Again'}
              </ToastAction>
            ),
          });
        } else {
          toast({
            title: errorMapping.title,
            description: error.message || errorMapping.message,
            variant: 'destructive',
            duration: 0,
          });
        }
      } else {
        trackVoiceMetrics({
          phase: context.phase === 'voice-entry' ? 'total' : 'voice-entry',
          duration: context.durationMs ?? 0,
          success: false,
          error: 'Unknown error',
        });

        const errorMapping = getErrorMessage(ErrorCodes.UNKNOWN);
        toast({
          title: errorMapping.title,
          description: errorMapping.message,
          variant: 'destructive',
          duration: 5000,
          action: (
            <ToastAction altText="Try again" onClick={onResetToIdle}>
              {errorMapping.action ?? 'Try Again'}
            </ToastAction>
          ),
        });
      }

      setTimeout(() => {
        setRecordingState('idle');
      }, 2000);
    },
    [onResetToIdle]
  );

  return { dispatchError };
}
