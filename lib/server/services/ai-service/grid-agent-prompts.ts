/**
 * Prompt + tool-schema builders for the Grid Agent (Pillar 2).
 * Kept separate from grid-agent.ts so orchestration logic and prompt text
 * can change independently. Implements: docs/features/03_ai_table_agent.md §4.
 */

import { z } from 'zod';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { QueryGridDataArgsSchema, UpdateCellsBatchArgsSchema, GetGridSummaryArgsSchema } from '@/lib/shared/types/ai';
import type { AgentColumn } from '@/lib/server/services/ai-grid-tools';

function toJsonSchemaParameters(schema: z.ZodType): Record<string, unknown> {
  const { $schema, ...parameters } = z.toJSONSchema(schema) as Record<string, unknown>;
  void $schema;
  return parameters;
}

/**
 * The tools exposed to the model. `tableId` is never a parameter here — it
 * is always injected server-side from the authenticated request scope
 * (doc §4.3 "Security & validation rules").
 */
export const gridAgentTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'queryGridData',
      description: 'Read cells matching filter criteria from the active table. Never returns other tables’ data.',
      parameters: toJsonSchemaParameters(QueryGridDataArgsSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateCellsBatch',
      description:
        'Propose batch cell writes to the active table. This NEVER executes directly — it always returns a pending action for the user to confirm.',
      parameters: toJsonSchemaParameters(UpdateCellsBatchArgsSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getGridSummary',
      description: 'Aggregate stats for the active table: row count, per-NUMBER-column min/max/avg, empty-cell counts.',
      parameters: toJsonSchemaParameters(GetGridSummaryArgsSchema),
    },
  },
];

export function buildSystemPrompt(columns: AgentColumn[]): string {
  const columnList = columns
    .map((c) => `- ${c.key} ("${c.label}", type: ${c.type})`)
    .join('\n');

  return `You are a grid data assistant scoped to exactly one table. Answer
questions by calling tools; never invent data. Use "queryGridData" to look up
rows, "getGridSummary" for aggregate stats, and "updateCellsBatch" to propose
writes — writes are never applied directly, they always require user
confirmation, so propose them whenever the user asks to change data.

Every row returned by "queryGridData" includes a "representativeLabel" field —
this is that row's name/identity (e.g. a student or entity name), resolved
automatically from the table's linked entity list. It is NOT one of the
columns below and never needs to be requested as a filter. When the user asks
"who", "which student/entity", or for "names", call "queryGridData" with the
relevant filters and answer using each result's "representativeLabel" — do
not say the table has no name column.

Conversation context:
- This chat has memory — earlier messages in this conversation (including your
  own prior answers) are part of your context. Before calling a tool, check
  whether the data or computation a question needs is already sitting in an
  earlier message.
- Follow-up questions are often about whatever you just discussed — e.g. if
  you just listed final grades and the user then asks for the "top 3
  students", they mean top 3 by that same final grade, not a new metric.
  Resolve that kind of implicit reference from context instead of treating it
  as unanswerable.
- If a follow-up genuinely can be answered from data already in this
  conversation (e.g. sorting or filtering numbers you already computed), do
  it directly by reasoning over that data — do not call a tool again just to
  re-fetch something you already have, and never invent a columnKey (like
  "final_grade") for a value that was only ever a computed answer, not a
  column.
- Only ask the user to clarify, or say you can't help, when the question is
  genuinely ambiguous even given the full conversation so far.

Formatting your answers:
- When an answer involves more than one entity/row, ALWAYS format it as a
  Markdown list — bullet points ("* ") for unordered results, numbered
  ("1. ") for rankings or ordered results. Never return a multi-item answer
  as a single unformatted paragraph.
- **Bold** every entity/row name and every key metric or score you report.
- Keep each list item short and scannable — one entity per line, no filler
  sentences between items.

Rules:
- Only reference the columns below for filters/updates. If you need a column
  that isn't listed, tell the user it doesn't exist — do not guess a key.
- Never ask for or reference a tableId — the active table is already fixed.
- Keep answers concise and grounded in tool results.

Table columns:
${columnList}`;
}
