/**
 * `@Mention` token parsing for the Schema Agent prompt bar.
 * Implements: docs/features/03_ai_table_agent.md §3.5
 *
 * Raw prompt text carries inline tokens `@[Name](baseList:<uuid>)`; the UI
 * strips these into a `mentions[]` array before submit, keeping the visible
 * prompt text as `@Name`.
 */

import type { Mention } from '@/lib/shared/types/ai';

export const MENTION_TOKEN_REGEX = /@\[([^\]]+)\]\(baseList:([0-9a-fA-F-]{36})\)/g;

export const MAX_MENTIONS = 5;

export interface MentionChip {
  id: string;
  name: string;
}

export interface ParsedMentions {
  prompt: string;
  mentions: Mention[];
  chips: MentionChip[];
}

/**
 * Replaces every mention token with its display text (`@Name`) and collects
 * the resolved `Mention[]`, deduped by id and capped at `MAX_MENTIONS`.
 */
export function parseMentions(raw: string): ParsedMentions {
  const seen = new Set<string>();
  const mentions: Mention[] = [];
  const chips: MentionChip[] = [];

  const prompt = raw.replace(MENTION_TOKEN_REGEX, (_match, name: string, id: string) => {
    if (!seen.has(id) && mentions.length < MAX_MENTIONS) {
      seen.add(id);
      mentions.push({ type: 'baseList', id });
      chips.push({ id, name });
    }
    return `@${name}`;
  });

  return { prompt, mentions, chips };
}

/**
 * Inserts a mention token at the active `@query` segment ending at
 * `caretPos`, replacing the partially-typed query text.
 */
export function insertMentionToken(
  raw: string,
  caretPos: number,
  query: string,
  item: MentionChip
): { next: string; nextCaret: number } {
  const before = raw.slice(0, caretPos);
  const after = raw.slice(caretPos);
  const queryStart = before.length - query.length - 1; // -1 for the leading '@'
  const token = `@[${item.name}](baseList:${item.id})`;

  const next = `${before.slice(0, queryStart)}${token}${after}`;
  const nextCaret = queryStart + token.length;

  return { next, nextCaret };
}

/**
 * Removes the mention token referencing `id` (e.g. via chip "×").
 */
export function removeMentionToken(raw: string, id: string): string {
  return raw.replace(MENTION_TOKEN_REGEX, (match, _name: string, tokenId: string) =>
    tokenId === id ? '' : match
  );
}

/**
 * Detects an in-progress `@query` segment immediately before the caret, so
 * the caller can open/filter the autocomplete dropdown.
 */
export function findActiveMentionQuery(raw: string, caretPos: number): string | null {
  const before = raw.slice(0, caretPos);
  const match = /@([\w ]*)$/.exec(before);
  return match ? match[1] : null;
}
