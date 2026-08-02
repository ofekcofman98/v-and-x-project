'use client';

/**
 * Prompt bar for the Schema Agent — natural language table creation with
 * `@Mention` autocomplete over the user's BaseLists.
 * Implements: docs/features/03_ai_table_agent.md §3.5
 *
 * Mention caret/chip handling lives in the shared `useMentionInput` hook
 * (lib/client/hooks/ai/use-mention-input.ts) — also used by GlobalChatPanel.
 */

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBaseListsQuery } from '@/lib/client/hooks/data/use-base-lists';
import { useMentionInput } from '@/lib/client/hooks/ai/use-mention-input';
import { MentionAutocomplete } from './MentionAutocomplete';
import { PromptDictationButton } from './PromptDictationButton';
import { Sparkles, X } from 'lucide-react';
import type { SchemaAgentRequest } from '@/lib/shared/types/ai';
import type { SchemaAgentError } from '@/lib/client/hooks/ai/use-schema-agent';

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 500;

interface SchemaAgentPromptBarProps {
  onSubmit: (request: SchemaAgentRequest) => void;
  isLoading: boolean;
  error: SchemaAgentError | null;
  onRetry: () => void;
}

export function SchemaAgentPromptBar({ onSubmit, isLoading, error, onRetry }: SchemaAgentPromptBarProps) {
  const { data: baseLists = [] } = useBaseListsQuery();

  const {
    raw,
    setRaw,
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
  } = useMentionInput({ baseLists, disabled: isLoading });

  function handleDictated(text: string) {
    setRaw(raw.trim() ? `${raw.trim()} ${text}` : text);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (handleMentionKeyDown(e)) return;

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const promptLength = raw.trim().length;
  const isTooShort = promptLength < MIN_PROMPT_LENGTH;
  const isTooLong = promptLength > MAX_PROMPT_LENGTH;
  const canSubmit = !isTooShort && !isTooLong && !isLoading;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({ prompt: raw.trim(), mentions });
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/90">
        <Sparkles className="h-4 w-4 text-purple-500" />
        Describe a table and let AI draft it
      </div>

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

      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={raw}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Create a grade table for @ClassA1 with columns Test1, Test2, FinalGrade"
            disabled={isLoading}
            className="min-h-[52px] max-h-32 resize-none bg-background/60"
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
        <PromptDictationButton onTranscribed={handleDictated} disabled={isLoading} />
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs ${isTooLong ? 'text-red-600' : 'text-muted-foreground'}`}>
          {promptLength}/{MAX_PROMPT_LENGTH}
          {isTooShort && promptLength > 0 ? ` (min ${MIN_PROMPT_LENGTH})` : ''}
        </span>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isLoading ? 'Drafting…' : 'Draft Table'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error.message}</span>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
