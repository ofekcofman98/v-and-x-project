'use client';

/**
 * Global Chat Panel — a slide-over chat spanning every Table linked to one
 * `@BaseList` mention, driving POST /api/ai/global-agent. Mirrors
 * GridChatPanel.tsx, with an `@Mention` input (shared `useMentionInput`
 * hook) instead of a fixed tableId.
 *
 * Only one `@BaseList` mention is supported per message (see plan "Global
 * BaseList Agent" — mention/routing decision). Once a mention is sent, it
 * becomes the conversation's `activeMention` (lib/client/stores/global-chat-
 * store.ts) and is reused for subsequent messages that don't include a new
 * `@Mention` — this lets the user keep chatting about the same BaseList
 * without retyping `@Name` every turn.
 */

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/shared/utils/cn';
import { useGlobalChatStore } from '@/lib/client/stores/global-chat-store';
import { useGlobalAgentTurnMutation, type GlobalAgentError } from '@/lib/client/hooks/ai/use-global-agent';
import { useBaseListsQuery } from '@/lib/client/hooks/data/use-base-lists';
import { useMentionInput } from '@/lib/client/hooks/ai/use-mention-input';
import { MentionAutocomplete } from './MentionAutocomplete';
import { GlobalActionConfirmDialog } from './GlobalActionConfirmDialog';

export function GlobalChatPanel() {
  const isOpen = useGlobalChatStore((s) => s.isOpen);
  const close = useGlobalChatStore((s) => s.close);
  const messages = useGlobalChatStore((s) => s.messages);
  const activeMention = useGlobalChatStore((s) => s.activeMention);
  const appendMessage = useGlobalChatStore((s) => s.appendMessage);
  const setActiveMention = useGlobalChatStore((s) => s.setActiveMention);
  const setPendingAction = useGlobalChatStore((s) => s.setPendingAction);

  const { data: baseLists = [] } = useBaseListsQuery();
  const [error, setError] = useState<GlobalAgentError | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const turnMutation = useGlobalAgentTurnMutation();

  const {
    raw,
    chips,
    mentions,
    activeIndex,
    setActiveIndex,
    suggestions,
    isDropdownOpen,
    textareaRef,
    handleChange,
    handleSelectSuggestion,
    handleRemoveChip,
    handleBlur,
    handleMentionKeyDown,
    reset,
  } = useMentionInput({
    baseLists,
    disabled: turnMutation.isPending,
    maxMentions: 1,
    onMentionLimitReached: () => setLimitNotice('Only one @BaseList per message for now.'),
  });

  const activeBaseListName = baseLists.find((list) => list.id === activeMention?.id)?.name;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit() {
    const message = raw.trim();
    if (!message || turnMutation.isPending) return;

    const mention = mentions[0] ?? activeMention;
    if (!mention) {
      setError(null);
      setLimitNotice('Mention a @BaseList to start — e.g. "@ClassA1 who scored above 60 in Q1?"');
      return;
    }

    setError(null);
    setLimitNotice(null);
    appendMessage({ role: 'user', content: message });
    setActiveMention(mention);
    reset();

    turnMutation.mutate(
      { message, mentions: [mention], history: messages },
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
    if (handleMentionKeyDown(e)) return;

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
            <SheetTitle>Global Chat</SheetTitle>
            <SheetDescription>
              {activeBaseListName
                ? `Chatting about @${activeBaseListName}. Mention a different @BaseList to switch.`
                : 'Mention a @BaseList to ask questions across all of its linked tables.'}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="flex flex-col gap-3 pb-2">
              {messages.length === 0 && (
                <p className="text-sm text-gray-500">
                  Try &ldquo;@ClassA1 who scored above 60 in Q1 and has attendance under 80%?&rdquo;
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
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip.id}
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 px-2.5 py-1 text-xs font-medium"
                  >
                    @{chip.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveChip(chip.id)}
                      aria-label={`Remove ${chip.name} mention`}
                      className="hover:text-purple-950"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={raw}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder="@ClassA1 who scored above 60 in Q1?"
                disabled={turnMutation.isPending}
                className="min-h-[64px]"
              />
              {isDropdownOpen && (
                <MentionAutocomplete
                  items={suggestions}
                  activeIndex={activeIndex}
                  onSelect={handleSelectSuggestion}
                  onHoverIndex={setActiveIndex}
                />
              )}
            </div>

            <div className="flex items-center justify-between">
              {error ? (
                <span className="text-xs text-red-600">{error.message}</span>
              ) : limitNotice ? (
                <span className="text-xs text-amber-600">{limitNotice}</span>
              ) : (
                <span className="text-xs text-gray-400">Ctrl/Cmd + Enter to send</span>
              )}
              <Button onClick={handleSubmit} disabled={!raw.trim() || turnMutation.isPending}>
                {turnMutation.isPending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <GlobalActionConfirmDialog />
    </>
  );
}
