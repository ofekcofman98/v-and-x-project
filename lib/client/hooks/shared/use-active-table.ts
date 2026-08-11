'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import type { TableSchema } from '@/lib/shared/types/table-schema';

/**
 * Owns the "the workspace's active table changed" transition for a grid
 * surface: tells the UI store which table is active (clearing the pointer
 * and any in-flight voice/confirmation state via setActiveTable), then
 * reseeds the Smart Pointer to (Row 0, first non-base column) once the new
 * table's schema is available, so voice input is immediately usable.
 * Implements: docs/features/16_master_detail_workspace.md §5
 */
export function useActiveTable({
  tableId,
  tableSchema,
}: {
  tableId: string | undefined;
  tableSchema: TableSchema;
}): void {
  const setActiveTable = useUIStore((state) => state.setActiveTable);
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const activeTableId = useUIStore((state) => state.activeTableId);
  const activeCell = useUIStore((state) => state.activeCell);

  useEffect(() => {
    setActiveTable(tableId ?? null);
    // Only the table id should trigger the "table changed" transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, setActiveTable]);

  useEffect(() => {
    if (!tableId || tableId !== activeTableId || activeCell) return;

    const firstRow = tableSchema.rows[0];
    const firstEditableColumn = tableSchema.columns.find((col) => !col.isBaseColumn);
    if (!firstRow || !firstEditableColumn) return;

    setActiveCell({ rowKey: firstRow.id, tableColumnId: firstEditableColumn.id });
  }, [tableId, activeTableId, activeCell, tableSchema, setActiveCell]);
}
