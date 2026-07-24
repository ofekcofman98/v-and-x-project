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
- Column "type" must be exactly one of: TEXT, NUMBER, DATE, BOOLEAN.
- Column "order" starts at 0 and increments per column, no gaps or duplicates.
- Do not invent a baseListId or representativeColumnKey — omit them entirely.

Output format:
{
  "name": "string",
  "description": "string or null",
  "columns": [
    { "key": "string", "label": "string", "type": "TEXT|NUMBER|DATE|BOOLEAN", "order": 0 }
  ]
}`;
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
