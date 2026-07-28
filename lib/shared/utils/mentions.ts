/**
 * `@Mention` handling for the Schema Agent prompt bar.
 * Implements: docs/features/03_ai_table_agent.md §3.5
 *
 * The visible prompt text only ever shows the clean human-readable
 * `@Name` — no internal BaseList ids are inserted into or exposed through
 * the textarea. Resolved `Mention[]` (for the API payload) are derived by
 * cross-referencing the plain text against the chips tracked in component
 * state, so manually deleting `@Name` text also drops the mention.
 */

import type { Mention } from '@/lib/shared/types/ai';

export const MAX_MENTIONS = 5;

export interface MentionChip {
  id: string;
  name: string;
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

/**
 * Replaces the active `@query` segment ending at `caretPos` with the clean
 * display text `@Name ` — plain text only, never an id.
 */
export function insertMentionText(
  raw: string,
  caretPos: number,
  query: string,
  item: MentionChip
): { next: string; nextCaret: number } {
  const before = raw.slice(0, caretPos);
  const after = raw.slice(caretPos);
  const queryStart = before.length - query.length - 1; // -1 for the leading '@'
  const displayText = `@${item.name} `;

  const next = `${before.slice(0, queryStart)}${displayText}${after}`;
  const nextCaret = queryStart + displayText.length;

  return { next, nextCaret };
}

/**
 * Removes the first `@Name` occurrence for the given chip from the raw text
 * (e.g. clicking the chip's "×"), swallowing the trailing space it was
 * inserted with.
 */
export function removeMentionText(raw: string, name: string): string {
  const token = `@${name}`;
  const idx = raw.indexOf(token);
  if (idx === -1) return raw;

  let end = idx + token.length;
  if (raw[end] === ' ') end += 1;

  return raw.slice(0, idx) + raw.slice(end);
}

/**
 * Resolves which tracked mention chips are still referenced (as `@Name`) in
 * the raw text, dedupes by id, and caps at `MAX_MENTIONS`. Used both to
 * render the chip row and to build the `Mention[]` sent to the API.
 */
export function resolveMentions(
  raw: string,
  chips: MentionChip[],
  maxMentions: number = MAX_MENTIONS
): { mentions: Mention[]; chips: MentionChip[] } {
  const seen = new Set<string>();
  const resolvedChips: MentionChip[] = [];
  const mentions: Mention[] = [];

  for (const chip of chips) {
    if (seen.has(chip.id) || resolvedChips.length >= maxMentions) continue;
    if (!raw.includes(`@${chip.name}`)) continue;

    seen.add(chip.id);
    resolvedChips.push(chip);
    mentions.push({ type: 'baseList', id: chip.id });
  }

  return { mentions, chips: resolvedChips };
}
