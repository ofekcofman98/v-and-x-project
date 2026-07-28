'use client';

/**
 * Fixed-position trigger for the Grid Chat panel — mirrors VoiceButton's
 * fixed bottom-right mount pattern, placed bottom-left so the two don't
 * collide. Implements: docs/features/03_ai_table_agent.md §4.
 */

import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGridChatStore } from '@/lib/client/stores/grid-chat-store';

interface GridChatButtonProps {
  tableId: string;
}

export function GridChatButton({ tableId }: GridChatButtonProps) {
  const open = useGridChatStore((s) => s.open);

  return (
    <Button
      size="icon"
      className="h-14 w-14 rounded-full shadow-lg"
      onClick={() => open(tableId)}
      aria-label="Open Grid Chat"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  );
}
