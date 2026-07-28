/**
 * VocalGrid AI Agent System — Shared Zod Contracts & Types
 *
 * Single source of validation truth for every LLM-facing API boundary across
 * the three AI Agent pillars. Implements: docs/features/03_ai_table_agent.md
 *
 * - Pillar 1: Schema Agent (@Mention table drafting) — §3
 * - Pillar 2: Grid Agent (MCP-style tool calling)     — §4
 * - Pillar 3: Batch Voice Parser (multi-entity entry) — §5
 *
 * This file lives in the shared zone (lib/shared/types/) and must remain
 * importable from both client and server code — no Node-only or OpenAI SDK
 * imports here.
 */

import { z } from 'zod';
import { ColumnType } from '@/lib/shared/types/column-types';

// ═══════════════════════════════════════════════════════════
// MENTION RESOLUTION
// ═══════════════════════════════════════════════════════════

/**
 * A resolved `@Mention` reference. The client resolves mention text to a
 * concrete entity ID at typing time (via autocomplete) — the server never
 * disambiguates names itself.
 */
export const MentionSchema = z.object({
  type: z.literal('baseList'), // extend with more literals (e.g. 'table') later
  id: z.uuid(),
});
export type Mention = z.infer<typeof MentionSchema>;

// ═══════════════════════════════════════════════════════════
// PILLAR 1 — SCHEMA AGENT DRAFT CONTRACT
// ═══════════════════════════════════════════════════════════

/**
 * A single drafted column, mirroring the Prisma `TableColumn` fields the
 * Schema Agent is allowed to control.
 */
export const TableColumnDraftSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, 'must be snake_case'),
  label: z.string().min(1).max(80),
  type: z.enum(ColumnType),
  order: z.number().int().min(0),
});
export type TableColumnDraft = z.infer<typeof TableColumnDraftSchema>;

/**
 * A drafted `Table` + `TableColumn[]` definition returned by the Schema
 * Agent. `baseListId` is always overwritten server-side from the resolved
 * `@Mention` — the LLM's value for it is never trusted for a foreign key.
 */
export const TableDraftSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  baseListId: z.uuid().nullable(),
  representativeColumnKey: z.string().min(1),
  columns: z.array(TableColumnDraftSchema).min(1).max(30),
});
export type TableDraft = z.infer<typeof TableDraftSchema>;

/**
 * Request body for `POST /api/ai/schema-agent`.
 */
export const SchemaAgentRequestSchema = z.object({
  prompt: z.string().min(10).max(500),
  mentions: z.array(MentionSchema).max(5),
});
export type SchemaAgentRequest = z.infer<typeof SchemaAgentRequestSchema>;

/**
 * Response payload for `POST /api/ai/schema-agent`. Not a Zod schema —
 * constructed server-side after the draft has already been validated, not
 * re-validated as LLM output.
 */
export interface SchemaAgentResponse {
  draft: TableDraft;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ═══════════════════════════════════════════════════════════
// PILLAR 2 — GRID AGENT / MCP TOOL CONTRACTS
// ═══════════════════════════════════════════════════════════

/**
 * Comparison operators supported by `queryGridData` filters.
 */
export const GridFilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'isEmpty',
  'isNotEmpty',
  'contains',
]);
export type GridFilterOperator = z.infer<typeof GridFilterOperatorSchema>;

export const GridFilterSchema = z.object({
  columnKey: z.string().min(1),
  operator: GridFilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});
export type GridFilter = z.infer<typeof GridFilterSchema>;

/**
 * LLM-supplied arguments for `queryGridData`. `tableId` is deliberately
 * excluded — it is always injected server-side from the authenticated
 * request scope, never accepted from the model.
 */
export const QueryGridDataArgsSchema = z.object({
  filters: z.array(GridFilterSchema).max(10),
  limit: z.number().int().min(1).max(200).default(50),
});
export type QueryGridDataArgs = z.infer<typeof QueryGridDataArgsSchema>;

export const CellUpdateSchema = z.object({
  rowKey: z.string().min(1),
  columnKey: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});
export type CellUpdate = z.infer<typeof CellUpdateSchema>;

/**
 * LLM-supplied arguments for `updateCellsBatch`. Same `tableId` exclusion
 * rule as `QueryGridDataArgsSchema` applies.
 */
export const UpdateCellsBatchArgsSchema = z.object({
  updates: z.array(CellUpdateSchema).min(1).max(100),
});
export type UpdateCellsBatchArgs = z.infer<typeof UpdateCellsBatchArgsSchema>;

/**
 * `getGridSummary` takes no arguments beyond the injected `tableId`.
 */
export const GetGridSummaryArgsSchema = z.object({});
export type GetGridSummaryArgs = z.infer<typeof GetGridSummaryArgsSchema>;

export type GridAgentToolName = 'queryGridData' | 'updateCellsBatch' | 'getGridSummary';

/**
 * A write action proposed by the Grid Agent, cached server-side (short TTL)
 * and re-executed verbatim on user confirmation — the LLM is out of the loop
 * at execution time.
 */
export interface PendingGridAction {
  actionId: string;
  kind: 'updateCellsBatch';
  summary: string;
  updates: CellUpdate[];
}

/**
 * Request body for `POST /api/ai/grid-agent`. `tableId` scopes the agent to
 * one table for the entire turn — it is the source of truth injected into
 * every tool call, never something the LLM can override.
 */
export const GridAgentTurnRequestSchema = z.object({
  tableId: z.uuid(),
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(20)
    .optional(),
});
export type GridAgentTurnRequest = z.infer<typeof GridAgentTurnRequestSchema>;

/**
 * Request body for `POST /api/ai/grid-agent/execute`. The `actionId` is the
 * only input — the update payload it resolves to was already fixed at
 * proposal time and is never re-derived from anything the client sends.
 */
export const GridAgentExecuteRequestSchema = z.object({
  actionId: z.string().min(1),
});
export type GridAgentExecuteRequest = z.infer<typeof GridAgentExecuteRequestSchema>;

/**
 * Response payload for `POST /api/ai/grid-agent`. Not a Zod schema —
 * constructed server-side, not re-validated as LLM output.
 */
export type GridAgentTurnResponse =
  | {
      answer: string;
      evidence?: { rows: Array<{ rowKey: string; representativeLabel: string }> };
    }
  | { pendingAction: PendingGridAction };

/** Result shape for the `queryGridData` tool (doc §4.2). */
export interface QueryGridDataResult {
  rows: Array<{ rowKey: string; representativeLabel: string; cells: Record<string, unknown> }>;
}

/** Result shape for the `updateCellsBatch` post-confirmation executor (doc §4.2). */
export interface UpdateCellsBatchResult {
  updated: number;
  failed: Array<{ rowKey: string; columnKey: string; reason: string }>;
}

/** Result shape for the `getGridSummary` tool (doc §4.2). */
export interface GetGridSummaryResult {
  rowCount: number;
  columns: Array<{
    key: string;
    type: ColumnType;
    filled: number;
    empty: number;
    avg?: number;
    min?: number;
    max?: number;
  }>;
}

// ═══════════════════════════════════════════════════════════
// PILLAR 3 — BATCH VOICE PARSER CONTRACT
// ═══════════════════════════════════════════════════════════

/**
 * A single (entity, value) pair as segmented by the LLM from a multi-entity
 * transcript, e.g. "Dan 85, Noa 90". The LLM only segments — it does not
 * resolve entity identity or validate the value; that is handled downstream
 * by the local matching engine and column-type parsers.
 */
export const BatchExtractionEntrySchema = z.object({
  entityText: z.string().min(1),
  rawValue: z.string().min(1),
});
export type BatchExtractionEntry = z.infer<typeof BatchExtractionEntrySchema>;

export const BatchExtractionSchema = z.object({
  entries: z.array(BatchExtractionEntrySchema).min(1).max(30),
});
export type BatchExtraction = z.infer<typeof BatchExtractionSchema>;

/**
 * Server-constructed shape for a single batch entry after fuzzy/phonetic
 * matching has run against the table's entity vocabulary. Not LLM-validated.
 */
export interface ResolvedBatchEntry {
  entityText: string;
  rawValue: string;
  entityId?: string;
  rowKey?: string;
  matchConfidence: number;
  candidates: Array<{
    entityId: string;
    label: string;
    confidence: number;
  }>;
}
