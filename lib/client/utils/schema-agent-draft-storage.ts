/**
 * Session-scoped handoff of a Schema Agent `TableDraft` from the tables list
 * page to the dedicated `/dashboard/tables/new` creation route, so the
 * full-screen `DynamicTableCreator` never renders inline over the list.
 * Implements: docs/features/03_ai_table_agent.md §3.
 */

import { TableDraftSchema, type TableDraft } from '@/lib/shared/types/ai';

const STORAGE_KEY = 'vocalgrid_ai_table_draft';

export function saveSchemaAgentDraft(draft: TableDraft): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

/**
 * Reads and clears the pending draft, if any. Returns `null` when absent or
 * malformed so a stale/corrupt entry never blocks the standard empty-creator
 * flow.
 */
export function consumeSchemaAgentDraft(): TableDraft | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);

  if (!raw) return null;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = TableDraftSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
