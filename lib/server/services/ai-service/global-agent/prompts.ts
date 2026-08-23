/**
 * Prompt + tool-schema builders for the Global Agent (multi-table @Mention
 * chat). Mirrors grid-agent-prompts.ts, but every tool takes a `tableId`
 * argument since a turn spans every Table linked to the mentioned BaseList
 * instead of one server-injected table.
 */

import { z } from 'zod';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import {
  GlobalQueryGridDataArgsSchema,
  GlobalUpdateCellsBatchArgsSchema,
  GlobalGetGridSummaryArgsSchema,
} from '@/lib/shared/types/ai';
import type { AgentColumn } from '@/lib/server/services/ai-service/tools/grid-tools';

function toJsonSchemaParameters(schema: z.ZodType): Record<string, unknown> {
  const { $schema, ...parameters } = z.toJSONSchema(schema) as Record<string, unknown>;
  void $schema;
  return parameters;
}

export interface GlobalAgentTable {
  tableId: string;
  name: string;
  columns: AgentColumn[];
}

/**
 * The tools exposed to the model. Unlike Grid Agent's tools, `tableId` IS a
 * parameter here — the model must say which table each call targets. It is
 * never trusted blindly: global-agent.ts validates it against the resolved
 * BaseList's table-id set before executing.
 */
export const globalAgentTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'queryGridData',
      description:
        'Read cells matching filter criteria from one of the mentioned BaseList\'s linked tables. Requires tableId.',
      parameters: toJsonSchemaParameters(GlobalQueryGridDataArgsSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateCellsBatch',
      description:
        'Propose batch cell writes to one of the mentioned BaseList\'s linked tables. This NEVER executes directly — it always returns a pending action for the user to confirm. Requires tableId.',
      parameters: toJsonSchemaParameters(GlobalUpdateCellsBatchArgsSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getGridSummary',
      description:
        'Aggregate stats for one of the mentioned BaseList\'s linked tables: row count, per-NUMBER-column min/max/avg, empty-cell counts. Requires tableId.',
      parameters: toJsonSchemaParameters(GlobalGetGridSummaryArgsSchema),
    },
  },
];

export function buildGlobalSystemPrompt(baseListName: string, tables: GlobalAgentTable[]): string {
  const tableList = tables
    .map((t) => {
      const columnList = t.columns.map((c) => `  - ${c.key} ("${c.label}", type: ${c.type})`).join('\n');
      return `Table "${t.name}" (tableId: ${t.tableId}):\n${columnList}`;
    })
    .join('\n\n');

  return `You are a data assistant for the BaseList "${baseListName}", which has
multiple linked tables. Answer questions by calling tools; never invent data.
Every tool call requires a "tableId" argument — pick it from the tables
listed below. Use "queryGridData" to look up rows, "getGridSummary" for
aggregate stats, and "updateCellsBatch" to propose writes — writes are never
applied directly, they always require user confirmation, so propose them
whenever the user asks to change data.

Cross-table questions: if answering requires combining data from more than
one table (e.g. "who scored above 60 in Q1 and has attendance under 80%"),
call "queryGridData" once per relevant table and combine the results
yourself. Rows across these tables that share the same "rowKey" represent the
same BaseList entity — join on "rowKey" to correlate a person/entity's data
across tables.

Every row returned by "queryGridData" includes a "representativeLabel" field
— this is that row's name/identity (e.g. a student or entity name), resolved
automatically from the BaseList's entity list. It is NOT one of the columns
below and never needs to be requested as a filter. When the user asks "who",
"which student/entity", or for "names", call "queryGridData" with the
relevant filters and answer using each result's "representativeLabel" — do
not say a table has no name column.

Conversation context:
- This chat has memory — earlier messages in this conversation (including
  your own prior answers) are part of your context. Before calling a tool,
  check whether the data or computation a question needs is already sitting
  in an earlier message.
- Follow-up questions are often about whatever you just discussed. Resolve
  implicit references from context instead of treating them as unanswerable,
  and never invent a columnKey for a value that was only ever a computed
  answer, not a column.
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
- Only reference the tables and columns listed below. If you need a table or
  column that isn't listed, tell the user it doesn't exist — do not guess a
  tableId or columnKey.
- Only one BaseList is in scope for this conversation — never ask for or
  reference a baseListId.
- Keep answers concise and grounded in tool results.

Tables in "${baseListName}":
${tableList}`;
}
