/**
 * CSV Import Hand-off Store
 * Ephemeral bridge between the CSV file-picker action and the
 * /dashboard/base-lists/new route, which can't receive complex objects
 * (parsed columns/rows) via URL params.
 */

import { create } from 'zustand';
import type { ColumnDef, RowData } from '@/components/shared-table/types';

export interface PendingCsvImport {
  name: string;
  columns: ColumnDef[];
  rows: RowData[];
}

interface CsvImportState {
  pending: PendingCsvImport | null;
  setPending: (pending: PendingCsvImport) => void;
  clearPending: () => void;
}

export const useCsvImportStore = create<CsvImportState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  clearPending: () => set({ pending: null }),
}));
