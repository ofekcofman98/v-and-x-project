'use client';

/**
 * ChatMicButton — presentational press-to-start / press-to-stop control for
 * a chat panel's hands-free voice loop. Deliberately separate from
 * PromptDictationButton: that button is click-to-stop, review-before-submit
 * dictation for the schema-agent prompt bar (a long table description you
 * edit before drafting); this drives a continuous, auto-submitting
 * question/answer loop for a quick chat turn.
 *
 * Takes the `useChatVoiceLoop` return value as a prop rather than owning the
 * hook itself — the panel needs `endTurn`/`phase` to drive the loop from its
 * own agent-mutation callbacks, so the panel owns the hook and this stays a
 * thin, stateless control. docs/features/17-voice-chat-loop.md §5
 */

import { Mic, Loader2, Bot, Volume2 } from 'lucide-react';
import type { useChatVoiceLoop, ChatVoicePhase } from '@/lib/client/hooks/voice/use-chat-voice-loop';
import { cn } from '@/lib/shared/utils/cn';

interface ChatMicButtonProps {
  loop: ReturnType<typeof useChatVoiceLoop>;
  /** Disables starting a new conversation (e.g. no @mention selected yet). Never blocks stopping. */
  disabled?: boolean;
}

const PHASE_ICON: Record<ChatVoicePhase, React.ReactNode> = {
  idle: <Mic className="h-4 w-4" />,
  listening: <Mic className="h-4 w-4" />,
  transcribing: <Loader2 className="h-4 w-4 animate-spin" />,
  answering: <Bot className="h-4 w-4 animate-pulse" />,
  speaking: <Volume2 className="h-4 w-4 animate-pulse" />,
};

const PHASE_LABEL: Record<ChatVoicePhase, string> = {
  idle: 'Start voice conversation',
  listening: 'Listening — click to stop',
  transcribing: 'Transcribing…',
  answering: 'Waiting for answer…',
  speaking: 'Speaking…',
};

export function ChatMicButton({ loop, disabled }: ChatMicButtonProps) {
  function handleClick() {
    if (loop.isActive) {
      // Always allow stopping, even mid-turn — a hung request must not trap
      // the user in the loop with no way out.
      loop.stop();
    } else {
      void loop.start();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!loop.isActive && disabled}
      aria-label={PHASE_LABEL[loop.phase]}
      aria-pressed={loop.isActive}
      title={PHASE_LABEL[loop.phase]}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        loop.phase === 'listening'
          ? 'bg-red-500 text-white shadow-[0_0_0_3px_rgba(239,68,68,0.25)] animate-pulse'
          : loop.isActive
            ? 'bg-primary/20 text-primary'
            : 'bg-primary/10 text-primary hover:bg-primary/20'
      )}
    >
      {PHASE_ICON[loop.phase]}
    </button>
  );
}
