/**
 * ComputedCell Component
 * Read-only cell that reactively evaluates a formula against sibling cell values.
 * Based on: docs/features/04_computed_columns.md
 */

'use client';

import { useTableCellStore } from '@/lib/client/stores/table-cell-store';
import { evaluateFormula, formatFormulaResult } from '@/lib/shared/utils/formula';
import type { ColumnFormula } from '@/lib/shared/types/formula';
import { Calculator } from 'lucide-react';
import { cn } from '@/lib/shared/utils/cn';

interface ComputedCellProps {
  rowKey: string;
  formula: ColumnFormula;
}

export function ComputedCell({ rowKey, formula }: ComputedCellProps) {
  // Selector re-runs evaluateFormula on every cellData change, but only
  // triggers a re-render when the derived number actually changes.
  const result = useTableCellStore((state) =>
    evaluateFormula(formula, (columnId) => state.getCellValue(rowKey, columnId))
  );

  const formattedValue = formatFormulaResult(result, formula);

  return (
    <td className="border-l first:border-l-0 p-0 bg-gray-50/60" style={{ borderColor: '#e5e7eb' }}>
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
