'use client';

/**
 * PromptDictationButton — speech-to-text for the schema-agent prompt bar.
 * Deliberately does NOT reuse VoiceButton/useVoicePipeline: those drive the
 * cell-fill/smart-pointer flow for an already-saved table (require a real
 * tableId + tableSchema). This button only records → transcribes → hands the
 * raw text back to the caller, via the same recording lifecycle as
 * useVoiceEntry and the same /api/transcribe route used by the voice pipeline.
 * Implements: docs/features/13_ux_ia_redesign.md § Visual Redesign
 */

import { useState } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { useVoiceEntry } from '@/lib/client/hooks/voice/use-voice-entry';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/shared/utils/cn';

interface PromptDictationButtonProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

export function PromptDictationButton({ onTranscribed, disabled }: PromptDictationButtonProps) {
  const { toast } = useToast();
  const [isTranscribing, setIsTranscribing] = useState(false);

  const { isRecording, startRecording, stopRecording } = useVoiceEntry({
    onAudioReady: async (audioBlob) => {
      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'prompt.webm');

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Transcription failed' }));
          throw new Error(err.error);
        }

        const { text } = await response.json();
        if (text?.trim()) onTranscribed(text.trim());
      } catch (error) {
        toast({
          title: 'Dictation failed',
          description: error instanceof Error ? error.message : 'Could not transcribe audio',
          variant: 'destructive',
        });
      } finally {
        setIsTranscribing(false);
      }
    },
    onError: (error) => {
      toast({ title: 'Microphone error', description: error.message, variant: 'destructive' });
    },
  });

  const isBusy = isTranscribing || disabled;

  return (
    <button
      type="button"
      onClick={() => (isRecording ? stopRecording() : startRecording())}
      disabled={isBusy}
      aria-label={isRecording ? 'Stop dictation' : 'Dictate prompt'}
      aria-pressed={isRecording}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isRecording
          ? 'bg-red-500 text-white shadow-[0_0_0_3px_rgba(239,68,68,0.25)] animate-pulse'
          : 'bg-primary/10 text-primary hover:bg-primary/20'
      )}
    >
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
