'use client';

/**
 * Fixed-position trigger for the Global Chat panel — mirrors
 * GridChatButton's fixed bottom-left mount pattern. Global scope, no props:
 * mounted once in app/dashboard/layout.tsx.
 */

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGlobalChatStore } from '@/lib/client/stores/global-chat-store';

export function GlobalChatButton() {
  const open = useGlobalChatStore((s) => s.open);

  return (
    <Button
      size="icon"
      className="h-14 w-14 rounded-full shadow-lg"
      onClick={() => open()}
      aria-label="Open Global Chat"
    >
      <Sparkles className="h-6 w-6" />
    </Button>
  );
}
