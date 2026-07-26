// ─────────────────────────────────────────────────────────────────────────────
// Row-first batch column targeting
// docs/features/03_ai_table_agent.md §5.5
// ─────────────────────────────────────────────────────────────────────────────

import type { ColumnDefinition } from '@/lib/shared/types/table-schema';

/**
 * Walks a row's editable columns forward from the active cell (inclusive),
 * taking up to `count` of them. If `count` exceeds the number of remaining
 * editable columns in the row, the excess is reported as `overflowCount` —
 * per §5.5, values that don't fit are parked, never spilled into the next
 * row.
 * Exported for unit testing (mirrors row-first.ts's convention of exporting
 * pure logic).
 */
export function resolveRowFirstColumnTargets<
  T extends Pick<ColumnDefinition, 'id' | 'isBaseColumn'>
>(
  activeCell: { tableColumnId: string },
  tableSchema: { columns: T[] },
  count: number
): { targets: T[]; overflowCount: number } {
  const editableColumns = tableSchema.columns.filter((c) => c.isBaseColumn !== true);
  const activeIndex = editableColumns.findIndex((c) => c.id === activeCell.tableColumnId);

  if (activeIndex === -1) {
    return { targets: [], overflowCount: count };
  }

  const remaining = editableColumns.slice(activeIndex);
  const targets = remaining.slice(0, count);
  const overflowCount = count - targets.length;

  return { targets, overflowCount };
}
