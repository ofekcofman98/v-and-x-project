/**
 * VoiceButton Component
 * Press-and-hold button to trigger voice recording
 * Based on: docs/05_VOICE_PIPELINE.md §2.2 and docs/08_UI_COMPONENTS.md
 */

'use client';

import { Mic, Square } from 'lucide-react';
import Fuse from 'fuse.js';
import { useVoiceEntry } from '@/lib/hooks/use-voice-entry';
import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils/cn';
import type { ParsedResult } from '@/lib/types/voice-pipeline';
import type { TableSchema } from '@/lib/types/table-schema';
import { VoiceErrors, VoiceInputError } from '@/lib/types/voice-errors';
import { trackVoiceMetrics } from '@/lib/monitoring/voice-metrics';

interface VoiceButtonProps {
  tableSchema: TableSchema;
}

export function VoiceButton({ tableSchema }: VoiceButtonProps) {
  const startRecording = useUIStore((state) => state.startRecording);
  const stopRecording = useUIStore((state) => state.stopRecording);
  const setRecordingState = useUIStore((state) => state.setRecordingState);
  const setPendingConfirmation = useUIStore((state) => state.setPendingConfirmation);
  const setError = useUIStore((state) => state.setError);
  const recordingState = useUIStore((state) => state.recordingState);
  const activeCell = useUIStore((state) => state.activeCell);
  const navigationMode = useUIStore((state) => state.navigationMode);

  const performFuzzyMatch = (rawEntity: string, rows: typeof tableSchema.rows) => {
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
  };

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

      trackVoiceMetrics({
        phase: 'voice-entry',
        duration,
        success: false,
        error: errorMessage,
      });

      if (response.status === 429) {
        throw VoiceErrors.STT_RATE_LIMIT;
      }

      throw new VoiceInputError(errorCode, errorMessage, true);
    }

    const parsed: ParsedResult = payload.data;
    const transcript = payload.data.transcript;

    console.log('Voice entry complete:', {
      transcript,
      transcriptionDuration: payload.data.transcriptionDuration,
      parsingDuration: payload.data.parsingDuration,
      totalDuration: payload.data.totalDuration,
    });

    if (parsed.action === 'AMBIGUOUS') {
      trackVoiceMetrics({
        phase: 'voice-entry',
        duration,
        success: false,
        error: 'Ambiguous match',
      });
      throw VoiceErrors.PARSE_AMBIGUOUS;
    }

    if (parsed.action === 'ERROR' || !parsed.valueValid) {
      trackVoiceMetrics({
        phase: 'voice-entry',
        duration,
        success: false,
        error: parsed.error ?? 'Invalid value',
      });

      if (!parsed.entity) {
        throw VoiceErrors.PARSE_NO_MATCH;
      }
      if (!parsed.valueValid) {
        throw VoiceErrors.PARSE_INVALID_VALUE;
      }
      throw new VoiceInputError(
        'PARSE_ERROR',
        parsed.error ?? parsed.reasoning ?? 'Could not parse command',
        true
      );
    }

    // Perform local fuzzy matching on the raw entity
    let finalEntity = parsed.entity ?? '';
    let finalConfidence = parsed.entityMatch?.confidence ?? 0;
    let alternatives = parsed.alternatives?.map((alt) => ({
      label: alt.entity,
      value: alt.entity,
    }));

    if (parsed.entity) {
      const fuzzyMatch = performFuzzyMatch(parsed.entity, tableSchema.rows);
      
      if (fuzzyMatch) {
        console.log('Local fuzzy match:', {
          original: parsed.entity,
          matched: fuzzyMatch.matched,
          confidence: fuzzyMatch.confidence,
        });

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

    trackVoiceMetrics({
      phase: 'voice-entry',
      duration,
      success: true,
    });

    // Auto-confirm if confidence is high (> 0.8)
    if (finalConfidence > 0.8) {
      console.log('High confidence match, auto-confirming:', {
        entity: finalEntity,
        confidence: finalConfidence,
      });

      setPendingConfirmation({
        entity: finalEntity,
        value: parsed.value as string | number | boolean | null,
        confidence: finalConfidence,
        alternatives,
      });

      setRecordingState('confirming');
    } else {
      console.log('Low confidence match, showing confirmation dialog:', {
        entity: finalEntity,
        confidence: finalConfidence,
      });

      setPendingConfirmation({
        entity: finalEntity,
        value: parsed.value as string | number | boolean | null,
        confidence: finalConfidence,
        alternatives,
      });

      setRecordingState('confirming');
    }
  };

  const handleAudioReady = async (audioBlob: Blob) => {
    setPendingConfirmation(null);
    setRecordingState('processing');
    
    const totalStartTime = Date.now();
    
    try {
      await processVoiceEntry(audioBlob);
      
      const totalDuration = Date.now() - totalStartTime;
      trackVoiceMetrics({
        phase: 'total',
        duration: totalDuration,
        success: true,
      });
    } catch (error) {
      const totalDuration = Date.now() - totalStartTime;
      
      if (error instanceof VoiceInputError) {
        console.error(`[Voice] ${error.code}:`, error.message);
        trackVoiceMetrics({
          phase: 'total',
          duration: totalDuration,
          success: false,
          error: error.code,
        });
      } else {
        console.error('Voice command error:', error);
        trackVoiceMetrics({
          phase: 'total',
          duration: totalDuration,
          success: false,
          error: 'Unknown error',
        });
      }
      
      setPendingConfirmation(null);
      setError();
    }
  };

  const handleVoiceError = (error: unknown) => {
    console.error('Recording error:', error);
    
    // Map native errors to VoiceInputError
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        console.error('[Voice]', VoiceErrors.MIC_PERMISSION_DENIED.code);
      } else if (error.name === 'NotFoundError') {
        console.error('[Voice]', VoiceErrors.MIC_NOT_FOUND.code);
      } else {
        console.error('[Voice]', VoiceErrors.RECORDING_FAILED.code);
      }
    }
    
    setPendingConfirmation(null);
    setError();
  };

  const {
    isRecording,
    audioLevel,
    startRecording: startRecordingHook,
    stopRecording: stopRecordingHook,
  } = useVoiceEntry({
    onAudioReady: handleAudioReady,
    onError: handleVoiceError,
  });

  const handleToggle = () => {
    if (isRecording) {
      stopRecording();
      stopRecordingHook();
      return;
    }

    startRecording();
    startRecordingHook();
  };

  const isListening = recordingState === 'listening' && isRecording;
  const isProcessing = recordingState === 'processing';
  const isError = recordingState === 'error';

  return (
    <div className="relative flex flex-col items-center gap-2">
      <button
        type="button"
        className={cn(
          'relative rounded-full p-6 transition-all duration-200',
          'focus:outline-none focus:ring-4 focus:ring-offset-2',
          'shadow-lg hover:shadow-xl',
          {
            'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300': !isListening && !isError,
            'bg-red-500 hover:bg-red-600 focus:ring-red-300 animate-pulse': isListening,
            'bg-gray-400 cursor-not-allowed': isProcessing,
            'bg-red-600': isError,
          }
        )}
        onClick={handleToggle}
        disabled={isProcessing}
        aria-label={isListening ? 'Stop recording' : 'Start recording'}
      >
        {isListening ? (
          <Square className="h-6 w-6 text-white" />
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}

        {isListening && audioLevel > 0 && (
          <div
            className="absolute inset-0 rounded-full bg-white/20 animate-ping"
            style={{ opacity: audioLevel }}
          />
        )}
      </button>

      {isListening && (
        <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-100"
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>
      )}

      <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
        {isListening && 'Tap to stop'}
        {isProcessing && 'Processing...'}
        {isError && 'Error occurred'}
        {!isListening && !isProcessing && !isError && 'Tap to record'}
      </div>
    </div>
  );
}
