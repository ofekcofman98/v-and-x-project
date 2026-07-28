'use client';

/**
 * Grid Chat Panel — a slide-over chat scoped to one active table, driving
 * POST /api/ai/grid-agent. Read-tool answers render inline; any proposed
 * write opens GridActionConfirmDialog instead of executing directly.
 * Implements: docs/features/03_ai_table_agent.md §4.
 */

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shared/utils/cn';
import { useGridChatStore } from '@/lib/client/stores/grid-chat-store';
import { useGridAgentTurnMutation, type GridAgentError } from '@/lib/client/hooks/ai/use-grid-agent';
import { GridActionConfirmDialog } from './GridActionConfirmDialog';

interface GridChatPanelProps {
  tableId: string;
}

export function GridChatPanel({ tableId }: GridChatPanelProps) {
  const isOpen = useGridChatStore((s) => s.isOpen);
  const close = useGridChatStore((s) => s.close);
  const messages = useGridChatStore((s) => s.messages);
  const appendMessage = useGridChatStore((s) => s.appendMessage);
  const setPendingAction = useGridChatStore((s) => s.setPendingAction);

  const [input, setInput] = useState('');
  const [error, setError] = useState<GridAgentError | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const turnMutation = useGridAgentTurnMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit() {
    const message = input.trim();
    if (!message || turnMutation.isPending) return;

    setError(null);
    appendMessage({ role: 'user', content: message });
    setInput('');

    turnMutation.mutate(
      { tableId, message, history: messages },
      {
        onSuccess: (response) => {
          if ('pendingAction' in response) {
            appendMessage({ role: 'assistant', content: `Proposed: ${response.pendingAction.summary}` });
            setPendingAction(response.pendingAction);
          } else {
            appendMessage({ role: 'assistant', content: response.answer });
          }
        },
        onError: (err) => setError(err),
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent side="right" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Grid Chat</SheetTitle>
            <SheetDescription>Ask questions or request changes for this table.</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="flex flex-col gap-3 pb-2">
              {messages.length === 0 && (
                <p className="text-sm text-gray-500">
                  Try &ldquo;Which rows are missing Assignment 2?&rdquo; or &ldquo;Set status to Absent for Dan
                  Cohen&rdquo;.
                </p>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm', {
                    'self-end bg-blue-600 text-white': message.role === 'user',
                    'self-start bg-gray-100 text-gray-900 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:mt-0.5 [&_strong]:font-semibold [&_p:not(:last-child)]:mb-1.5':
                      message.role === 'assistant',
                  })}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  ) : (
                    message.content
                  )}
                </div>
              ))}
              {turnMutation.isPending && (
                <div className="self-start rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-500">
                  Thinking…
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this table's data…"
              disabled={turnMutation.isPending}
              className="min-h-[64px]"
            />
            <div className="flex items-center justify-between">
              {error ? (
                <span className="text-xs text-red-600">{error.message}</span>
              ) : (
                <span className="text-xs text-gray-400">Ctrl/Cmd + Enter to send</span>
              )}
              <Button onClick={handleSubmit} disabled={!input.trim() || turnMutation.isPending}>
                {turnMutation.isPending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <GridActionConfirmDialog tableId={tableId} />
    </>
  );
}
