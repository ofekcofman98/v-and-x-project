'use client';

/**
 * Prompt bar for the Schema Agent — natural language table creation with
 * `@Mention` autocomplete over the user's BaseLists.
 * Implements: docs/features/03_ai_table_agent.md §3.5
 */

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBaseListsQuery } from '@/lib/client/hooks/use-base-lists';
import {
  findActiveMentionQuery,
  insertMentionToken,
  parseMentions,
  removeMentionToken,
} from '@/lib/shared/utils/mentions';
import { MentionAutocomplete, baseListToMentionItem } from './MentionAutocomplete';
import { Sparkles, X } from 'lucide-react';
import type { SchemaAgentRequest } from '@/lib/shared/types/ai';
import type { SchemaAgentError } from '@/lib/client/hooks/use-schema-agent';

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 500;

interface SchemaAgentPromptBarProps {
  onSubmit: (request: SchemaAgentRequest) => void;
  isLoading: boolean;
  error: SchemaAgentError | null;
  onRetry: () => void;
}

export function SchemaAgentPromptBar({ onSubmit, isLoading, error, onRetry }: SchemaAgentPromptBarProps) {
  const [raw, setRaw] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: baseLists = [] } = useBaseListsQuery();

  const { chips, prompt: displayPrompt } = useMemo(() => parseMentions(raw), [raw]);

  const suggestions = useMemo(() => {
    if (activeQuery === null) return [];
    const q = activeQuery.trim().toLowerCase();
    return baseLists
      .filter((list) => !q || list.name.toLowerCase().includes(q))
      .map(baseListToMentionItem)
      .slice(0, 8);
  }, [baseLists, activeQuery]);

  const isDropdownOpen = activeQuery !== null && !isLoading;

  function syncActiveQuery(value: string, caretPos: number) {
    setActiveQuery(findActiveMentionQuery(value, caretPos));
    setActiveIndex(0);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setRaw(value);
    syncActiveQuery(value, e.target.selectionStart ?? value.length);
  }

  function handleSelectSuggestion(item: { id: string; name: string }) {
    const el = textareaRef.current;
    const caretPos = el?.selectionStart ?? raw.length;
    const { next, nextCaret } = insertMentionToken(raw, caretPos, activeQuery ?? '', item);
    setRaw(next);
    setActiveQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleRemoveChip(id: string) {
    setRaw((prev) => removeMentionToken(prev, id));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isDropdownOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const promptLength = displayPrompt.trim().length;
  const isTooShort = promptLength < MIN_PROMPT_LENGTH;
  const isTooLong = promptLength > MAX_PROMPT_LENGTH;
  const canSubmit = !isTooShort && !isTooLong && !isLoading;

  function handleSubmit() {
    if (!canSubmit) return;
    const { prompt, mentions } = parseMentions(raw);
    onSubmit({ prompt, mentions });
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
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

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={raw}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setActiveQuery(null), 150)}
          placeholder="Create a grade table for @ClassA1 with columns Test1, Test2, FinalGrade"
          disabled={isLoading}
          className="min-h-[72px]"
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
