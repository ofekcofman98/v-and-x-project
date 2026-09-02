/**
 * Table Cell Store - Manages cell data for tables
 * Based on: docs/04_STATE_MANAGEMENT.md §2.1
 */

import { create } from 'zustand';
import type { CellData } from '@/lib/shared/types/table-schema';
import { voiceTelemetry } from '@/lib/client/hooks/voice/use-voice-telemetry';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Composite key identifying a cell, for the justUpdatedCellKeys set. */
export function cellKey(rowKey: string, tableColumnId: string): string {
  return `${rowKey}:${tableColumnId}`;
}

// Matches the TanStack Query staleTime convention set in app/providers.tsx —
// avoids reflashing "Loading table data..." when the user re-enters a table
// they were already looking at within the last 5 minutes.
const CELLS_STALE_TIME_MS = 1000 * 60 * 5;

/**
 * Table Cell Store State
 */
interface TableCellState {
  // Cell data for the current table
  cellData: CellData[];
  /** Cells touched by the most recent write (single or batch), for triggering the success animation on every one of them — not just the last. */
  justUpdatedCellKeys: Set<string>;
  isLoading: boolean;      // track loading state
  error: string | null;    // track errors

  // Which table `cellData` currently holds, and when it was fetched —
  // lets fetchCells skip a redundant network round-trip on remount.
  loadedTableId: string | null;
  fetchedAt: number | null;

  // Actions
  setCellData: (data: CellData[]) => void;
  /** Pass `force: true` to bypass the staleness cache (e.g. a manual refresh action). */
  fetchCells: (tableId: string, options?: { force?: boolean }) => Promise<void>;
  /** `requestId`, when provided, marks db_write_ack_at on success (docs/features/19_voice_telemetry.md §7) — omitted by manual grid edits. */
  updateCell: (
    tableId: string,
    rowKey: string,
    tableColumnId: string,
    value: string | number | boolean | null,
    requestId?: string
  ) => Promise<void>;
  /**
   * Commits multiple cell writes in one transaction/one invalidation, for
   * the Multi-Entity Batch Voice Entry flow (docs/features/03_ai_table_agent.md §5.3).
   * Throws on failure so the caller (useVoiceBatchHandler) can decide
   * whether to retry — the pointer must not advance on a failed commit.
   * `requestId`, when provided, marks db_write_ack_at on success
   * (docs/features/19_voice_telemetry.md §7) — the caller finalizes
   * confirmation_route and flushes, since one batch requestId may span
   * multiple partial commits (§12).
   */
  updateCellsBatch: (
    tableId: string,
    writes: Array<{ rowKey: string; tableColumnId: string; value: string | number | boolean | null }>,
    requestId?: string
  ) => Promise<void>;
  getCellValue: (rowKey: string, tableColumnId: string) => string | number | boolean | null | undefined;
  clearLastUpdated: () => void;
}

/**
 * Create the Table Cell Store
 */
export const useTableCellStore = create<TableCellState>((set, get) => ({
  // Initial state
  cellData: [],
  justUpdatedCellKeys: new Set(),
  isLoading: false,
  error: null,
  loadedTableId: null,
  fetchedAt: null,

  // Set the entire cell data array
  setCellData: (data) => set({ cellData: data }),

  fetchCells: async (tableId: string, options) => {
    const { loadedTableId, fetchedAt, error } = get();
    const isFresh =
      !options?.force &&
      !error &&
      loadedTableId === tableId &&
      fetchedAt !== null &&
      Date.now() - fetchedAt < CELLS_STALE_TIME_MS;

    if (isFresh) return;

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/tables/${tableId}/cells`);

      if (!response.ok) {
        throw new Error(`Failed to fetch cells: ${response.statusText}`);
      }

      const result = await response.json();

      // The API returns { data: cells } due to apiSuccess wrapper
      const cells = result.data;

      // Transform the API response to match CellData interface
      const cellData: CellData[] = cells.map((cell: any) => ({
        rowKey: cell.rowKey,
        tableColumnId: cell.tableColumnId,
        value: cell.value?.value ?? null,  // The DB stores value in JSON format
        entityId: cell.entityId,
        entrySource: cell.entrySource,
      }));

      set({ cellData, isLoading: false, loadedTableId: tableId, fetchedAt: Date.now() });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, isLoading: false, loadedTableId: null, fetchedAt: null });
      console.error('Error fetching cells:', error);
    }
  },

  // Update a single cell
  updateCell: async (
    tableId: string,
    rowKey: string,
    tableColumnId: string,
    value: string | number | boolean | null,
    requestId?: string
  ) => {
    // Guard: both identifiers must be database UUIDs. Base-list column IDs
    // are human-readable slugs (e.g. "first_name") and must never reach the API.
    if (!UUID_REGEX.test(rowKey) || !UUID_REGEX.test(tableColumnId)) {
      set({
        error:
          'Cannot save: the selected cell uses a read-only base-list column. ' +
          'Please select a data-entry column before saving.',
      });
      return;
    }

    // 1. SAVE THE PREVIOUS STATE (for rollback)
    const previousCellData = [...get().cellData];
    
    // 2. OPTIMISTIC UPDATE: Update local state immediately
    set((state) => {
      const existingIndex = state.cellData.findIndex(
        (cell) => cell.rowKey === rowKey && cell.tableColumnId === tableColumnId
      );
      
      let newCellData: CellData[];
      
      if (existingIndex >= 0) {
        // Update existing cell
        newCellData = [...state.cellData];
        newCellData[existingIndex] = {
          ...newCellData[existingIndex],
          value,
        };
      } else {
        // Add new cell
        newCellData = [
          ...state.cellData,
          { rowKey, tableColumnId, value },
        ];
      }
      
      return {
        cellData: newCellData,
        justUpdatedCellKeys: new Set([cellKey(rowKey, tableColumnId)]),
      };
    });
    
    // 3. SEND API REQUEST
    try {
      const response = await fetch(`/api/tables/${tableId}/cells`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowKey,
          tableColumnId,
          value,
          // entrySource: 'MANUAL',  // Optional: specify how this was entered
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update cell: ${response.statusText}`);
      }
      
      // Success! The optimistic update was correct
      // Optionally, you could update with the server response
      const result = await response.json();
      console.log('Cell updated successfully:', result);

      // docs/features/19_voice_telemetry.md §7 — db_write_ack_at, flush.
      // requestId reaching here means no confirmation dialog interrupted the
      // flow (Constraint 2) — 'auto' unless an earlier confirm step already
      // set a different route.
      if (requestId) {
        voiceTelemetry.mark(requestId, 'dbWriteAckAt');
        voiceTelemetry.setConfirmationRoute(requestId, 'auto');
        voiceTelemetry.flush(requestId);
      }

    } catch (error) {
      // 4. ROLLBACK: If the API fails, restore previous state
      console.error('Error updating cell:', error);
      
      set({
        cellData: previousCellData,
        error: error instanceof Error ? error.message : 'Failed to update cell',
      });
      
      // Optionally show a toast notification to the user
      // toast.error('Failed to update cell. Please try again.');
      
      return; // Exit early, don't clear lastUpdatedCell
    }
    
    // 5. CLEAR SUCCESS INDICATOR after animation
    setTimeout(() => {
      get().clearLastUpdated();
    }, 1000);
  },
  
  
  // Commit multiple cell writes in one transaction/one invalidation
  updateCellsBatch: async (tableId, writes, requestId) => {
    // Same UUID guard as updateCell — base-list column IDs (human-readable
    // slugs) must never reach the API.
    const invalid = writes.find(
      (w) => !UUID_REGEX.test(w.rowKey) || !UUID_REGEX.test(w.tableColumnId)
    );
    if (invalid) {
      set({
        error:
          'Cannot save: one or more selected cells use a read-only base-list column. ' +
          'Please select a data-entry column before saving.',
      });
      throw new Error('Batch write targeted a non-UUID (base-list) column');
    }

    if (writes.length === 0) return;

    // 1. SAVE THE PREVIOUS STATE (for rollback)
    const previousCellData = [...get().cellData];

    // 2. OPTIMISTIC UPDATE: merge all writes into local state at once
    set((state) => {
      let newCellData = [...state.cellData];

      for (const { rowKey, tableColumnId, value } of writes) {
        const existingIndex = newCellData.findIndex(
          (cell) => cell.rowKey === rowKey && cell.tableColumnId === tableColumnId
        );

        if (existingIndex >= 0) {
          newCellData[existingIndex] = { ...newCellData[existingIndex], value };
        } else {
          newCellData = [...newCellData, { rowKey, tableColumnId, value }];
        }
      }

      return {
        cellData: newCellData,
        justUpdatedCellKeys: new Set(writes.map((w) => cellKey(w.rowKey, w.tableColumnId))),
      };
    });

    // 3. SEND ONE BATCH API REQUEST
    try {
      const response = await fetch(`/api/tables/${tableId}/cells/batch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update cells: ${response.statusText}`);
      }

      // docs/features/19_voice_telemetry.md §7, §12 — db_write_ack_at only.
      // confirmation_route ('batch') and flush are the caller's
      // responsibility (useVoiceBatchHandler.confirmBatch) since one
      // requestId can span multiple partial commits.
      if (requestId) {
        voiceTelemetry.mark(requestId, 'dbWriteAckAt');
      }
    } catch (error) {
      // 4. ROLLBACK: If the API fails, restore previous state — no partial
      // commit is reflected client-side either, matching the transaction's
      // all-or-nothing server-side semantics.
      console.error('Error updating cells (batch):', error);

      set({
        cellData: previousCellData,
        error: error instanceof Error ? error.message : 'Failed to update cells',
      });

      throw error;
    }

    // 5. CLEAR SUCCESS INDICATOR after animation
    setTimeout(() => {
      get().clearLastUpdated();
    }, 1000);
  },

  // Get a cell value
  getCellValue: (rowKey, tableColumnId) => {
    const cell = get().cellData.find(
      (d) => d.rowKey === rowKey && d.tableColumnId === tableColumnId
    );
    return cell?.value;
  },
    
  // Clear the just-updated cell markers
  clearLastUpdated: () => set({ justUpdatedCellKeys: new Set() }),
}));
