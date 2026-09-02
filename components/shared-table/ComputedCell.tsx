/**
 * ComputedCell Component
 * Read-only cell that reactively evaluates a formula against sibling cell values.
 * Based on: docs/features/04_computed_columns.md
 */

'use client';

import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { useShallow } from 'zustand/react/shallow';
import { evaluateFormula, formatFormulaResult } from '@/lib/shared/utils/formula';
import type { ColumnFormula } from '@/lib/shared/types/formula';
import { Calculator } from 'lucide-react';
import { cn } from '@/lib/shared/utils/cn';

interface ComputedCellProps {
  rowKey: string;
  /** Needed so this cell can participate in the nav-mode column/row band —
   * without it, a computed column renders as a visual hole in an otherwise
   * banded column. docs/features/15_realtime_voice_feedback.md §6 */
  tableColumnId: string;
  formula: ColumnFormula;
}

export function ComputedCell({ rowKey, tableColumnId, formula }: ComputedCellProps) {
  // Selector re-runs evaluateFormula on every cellData change, but only
  // triggers a re-render when the derived number actually changes.
  const result = useTableCellStore((state) =>
    evaluateFormula(formula, (columnId) => state.getCellValue(rowKey, columnId))
  );

  // Same band shape as DataTableCell — computed cells are always read-only,
  // so there's no "active cell" case to exclude here. Primitives extracted
  // via useShallow, boolean derived below (see DataTableCell for why).
  // docs/features/15_realtime_voice_feedback.md §6
  const { navigationMode, activeRowKey, activeColumnId } = useUIStore(
    useShallow((state) => ({
      navigationMode: state.navigationMode,
      activeRowKey: state.activeCell?.rowKey ?? null,
      activeColumnId: state.activeCell?.tableColumnId ?? null,
    }))
  );
  const isInActiveBand =
    activeRowKey !== null &&
    (() => {
      switch (navigationMode) {
        case 'column-first':
          return activeColumnId === tableColumnId;
        case 'row-first':
        case 'entity-first':
          return activeRowKey === rowKey;
        default: {
          const _exhaustive: never = navigationMode;
          return _exhaustive;
        }
      }
    })();

  const formattedValue = formatFormulaResult(result, formula);

  return (
    <td
      className="border-l first:border-l-0 p-0 bg-gray-50/60"
      style={{
        borderColor: '#e5e7eb',
        background: isInActiveBand ? 'rgba(19,80,27,0.05)' : undefined,
      }}
    >
      <div className="relative h-9 w-full">
        <div
          className={cn(
            'flex items-center gap-1 w-full h-full px-2 py-1 text-sm overflow-hidden',
            'cursor-default select-none text-gray-500 font-mono'
          )}
        >
          <Calculator className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="truncate">{formattedValue}</span>
        </div>
      </div>
    </td>
  );
}
