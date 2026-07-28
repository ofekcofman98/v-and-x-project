'use client';

/**
 * Shared `@Mention` input state/handlers — extracted from
 * SchemaAgentPromptBar.tsx so both it and GlobalChatPanel.tsx can drive a
 * textarea with `@BaseList` autocomplete without duplicating caret-tracking
 * and chip-state logic. Implements: docs/features/03_ai_table_agent.md §3.5.
 *
 * The textarea only ever displays clean `@Name` text — mention ids are
 * tracked separately in chip state and cross-referenced against the visible
 * text (via `resolveMentions`) to build the API payload.
 */

import { useMemo, useRef, useState } from 'react';
import {
  findActiveMentionQuery,
  insertMentionText,
  removeMentionText,
  resolveMentions,
  MAX_MENTIONS,
  type MentionChip,
} from '@/lib/shared/utils/mentions';
import { baseListToMentionItem, type MentionAutocompleteItem } from '@/components/ai/MentionAutocomplete';
import type { Mention } from '@/lib/shared/types/ai';
import type { BaseListDTO } from '@/lib/shared/types/models';

export interface UseMentionInputOptions {
  baseLists: BaseListDTO[];
  /** Disables opening the dropdown while true (e.g. a request is in flight). */
  disabled?: boolean;
  /** Caps how many mention chips can be active at once. Defaults to MAX_MENTIONS (5). */
  maxMentions?: number;
  /** Called when a selection would exceed maxMentions — e.g. to show inline copy. */
  onMentionLimitReached?: () => void;
}

export function useMentionInput({
  baseLists,
  disabled = false,
  maxMentions = MAX_MENTIONS,
  onMentionLimitReached,
}: UseMentionInputOptions) {
  const [raw, setRaw] = useState('');
  const [mentionChips, setMentionChips] = useState<MentionChip[]>([]);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { chips, mentions } = useMemo(
    () => resolveMentions(raw, mentionChips, maxMentions),
    [raw, mentionChips, maxMentions]
  );

  const suggestions: MentionAutocompleteItem[] = useMemo(() => {
    if (activeQuery === null) return [];
    const q = activeQuery.trim().toLowerCase();
    return baseLists
      .filter((list) => !q || list.name.toLowerCase().includes(q))
      .map(baseListToMentionItem)
      .slice(0, 8);
  }, [baseLists, activeQuery]);

  const isDropdownOpen = activeQuery !== null && !disabled;

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
    if (chips.length >= maxMentions && !chips.some((c) => c.id === item.id)) {
      onMentionLimitReached?.();
      setActiveQuery(null);
      return;
    }

    const el = textareaRef.current;
    const caretPos = el?.selectionStart ?? raw.length;
    const { next, nextCaret } = insertMentionText(raw, caretPos, activeQuery ?? '', item);
    setRaw(next);
    setMentionChips((prev) => (prev.some((c) => c.id === item.id) ? prev : [...prev, item]));
    setActiveQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleRemoveChip(id: string) {
    const chip = mentionChips.find((c) => c.id === id);
    if (!chip) return;
    setRaw((prev) => removeMentionText(prev, chip.name));
    setMentionChips((prev) => prev.filter((c) => c.id !== id));
  }

  function handleBlur() {
    setTimeout(() => setActiveQuery(null), 150);
  }

  /**
   * Handles dropdown navigation keys (Arrow Up/Down, Enter, Escape) while the
   * autocomplete is open. Returns true if the key was consumed — callers
   * should `return` early (skipping their own Enter-to-submit handling) in
   * that case.
   */
  function handleMentionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (!isDropdownOpen || suggestions.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      return true;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectSuggestion(suggestions[activeIndex]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setActiveQuery(null);
      return true;
    }

    return false;
  }

  function reset() {
    setRaw('');
    setMentionChips([]);
    setActiveQuery(null);
    setActiveIndex(0);
  }

  return {
    raw,
    setRaw,
    chips,
    mentions,
    activeQuery,
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
  } satisfies {
    raw: string;
    setRaw: (value: string) => void;
    chips: MentionChip[];
    mentions: Mention[];
    activeQuery: string | null;
    activeIndex: number;
    setActiveIndex: (updater: number | ((prev: number) => number)) => void;
    suggestions: MentionAutocompleteItem[];
    isDropdownOpen: boolean;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSelectSuggestion: (item: MentionChip) => void;
    handleRemoveChip: (id: string) => void;
    handleBlur: () => void;
    handleMentionKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
    reset: () => void;
  };
}
