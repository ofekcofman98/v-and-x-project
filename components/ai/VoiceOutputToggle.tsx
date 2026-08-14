'use client';

/**
 * VoiceOutputToggle — mutes/unmutes spoken auto-playback of agent chat
 * answers. Reads/writes the shared `voiceOutputEnabled` flag in ui-store.ts
 * so both GridChatPanel and GlobalChatPanel stay in sync.
 * docs/features/17-voice-chat-loop.md §6
 */

import { Volume2, VolumeX } from 'lucide-react';
import { useUIStore } from '@/lib/client/stores/ui-store';

export function VoiceOutputToggle() {
  const voiceOutputEnabled = useUIStore((s) => s.voiceOutputEnabled);
  const setVoiceOutputEnabled = useUIStore((s) => s.setVoiceOutputEnabled);

  return (
    <button
      type="button"
      onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
      aria-label={voiceOutputEnabled ? 'Mute spoken responses' : 'Unmute spoken responses'}
      aria-pressed={voiceOutputEnabled}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {voiceOutputEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </button>
  );
}
