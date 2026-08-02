/**
 * Prompt builders for the Schema Agent (Pillar 1).
 * Kept separate from schema-agent.ts so orchestration logic and prompt text
 * can change independently. Implements: docs/features/03_ai_table_agent.md §3.
 */

import type { MentionContext } from '@/lib/server/services/ai-service/context';

export function buildSystemPrompt(): string {
  return `You are a table schema generator for a data-tracking product. Given a
user's natural language request and (optionally) an existing entity list's
metadata, propose a table name, description, and column list.

Rules:
- Return ONLY valid JSON, no markdown fences.
- Column "key" must be snake_case (regex: ^[a-z][a-z0-9_]*$).
- Column "type" must be exactly one of: TEXT, NUMBER, DATE, BOOLEAN, COMPUTED.
- Column "order" starts at 0 and increments per column, no gaps or duplicates.
- Do not invent a baseListId or representativeColumnKey — omit them entirely.
- If a referenced entity list is given, its fields (e.g. name, ID, email) are
  already part of every table built from it — do NOT add columns that
  duplicate or restate those fields (no "student ID", "student name", etc.).
  Only draft columns for NEW data this specific request needs to collect.

Computed columns (type "COMPUTED"):
- Use these whenever the user asks for a total, sum, average, count, minimum,
  or maximum derived from other columns in the same table (e.g. "counts the
  number of questions answered", "final grade that sums up the questions").
  Never draft a plain NUMBER column for a value the user describes as derived
  from other columns — that value must be COMPUTED, not manually entered.
- A COMPUTED column requires a "formula" object:
  { "type": "sum"|"average"|"count"|"min"|"max", "references": ["<key>", ...] }
  "references" holds the "key" of other columns in THIS SAME columns array —
  1 to 10 of them, and every one must be a TEXT/NUMBER column you also drafted
  (never reference a base-list/entity-list field, and never reference another
  COMPUTED column).
- "count" counts how many of the referenced columns are filled in for a row
  (use it for "number of questions answered/completed", not a running total).

Output format:
{
  "name": "string",
  "description": "string or null",
  "columns": [
    { "key": "string", "label": "string", "type": "TEXT|NUMBER|DATE|BOOLEAN|COMPUTED", "order": 0, "formula": { "type": "sum", "references": ["key1", "key2"] } }
  ]
}
("formula" is only present when type is "COMPUTED".)`;
}

export function buildUserPrompt(prompt: string, contexts: MentionContext[]): string {
  const mentionBlock = contexts.length
    ? contexts
        .map(
          (c) =>
            `- "${c.name}" (${c.entityCount} existing entries) — fields: ${c.columns
              .map((col) => col.label)
              .join(', ')}`
        )
        .join('\n')
    : '(no linked entity list — this will be a standalone table)';

  return `Referenced entity list(s):\n${mentionBlock}\n\nUser request: "${prompt}"`;
}
