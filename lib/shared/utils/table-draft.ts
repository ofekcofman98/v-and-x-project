/**
 * Maps a Schema Agent `TableDraft` (snake_case keys, UPPERCASE `ColumnType`)
 * into the shared-table builder's `ColumnDef[]` shape (lowercase type),
 * so the AI draft can be previewed/edited in the existing grid builder.
 * Implements: docs/features/03_ai_table_agent.md §3.
 */

import type { ColumnDef } from '@/components/shared-table/types';
import type { TableDraft } from '@/lib/shared/types/ai';

export interface DraftColumnMapping {
  columns: ColumnDef[];
  representativeColumnId: string | null;
}

export function draftToColumnDefs(draft: TableDraft): DraftColumnMapping {
  const columns: ColumnDef[] = [...draft.columns]
    .sort((a, b) => a.order - b.order)
    .map((col) => ({
      id: col.key,
      name: col.label,
      type: col.type.toLowerCase() as ColumnDef['type'],
      metadata: { source: 'user_defined', locked: false },
    }));

  const representativeColumnId = draft.baseListId
    ? null // resolved against the injected base-list columns, not these drafted ones
    : (columns.find((c) => c.id === draft.representativeColumnKey)?.id ?? columns[0]?.id ?? null);

  return { columns, representativeColumnId };
}
