/**
 * FormulaBuilderDialog
 * Simple builder for computed columns: function dropdown + column checkboxes + live preview.
 * Based on: docs/features/04_computed_columns.md
 */

'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GridSelect } from './GridSelect';
import { evaluateFormula, formatFormulaResult } from '@/lib/shared/utils/formula';
import { FORMULA_FUNCTIONS, type ColumnFormula, type FormulaFunction } from '@/lib/shared/types/formula';
import type { ColumnDef } from './types';

const FUNCTION_LABELS: Record<FormulaFunction, string> = {
  sum: 'SUM',
  average: 'AVERAGE',
  count: 'COUNT',
  min: 'MIN',
  max: 'MAX',
};

interface FormulaBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number columns this computed column may reference (already excludes itself and other computed columns). */
  availableColumns: ColumnDef[];
  initialFormula?: ColumnFormula;
  onSave: (formula: ColumnFormula) => void;
  onCancel: () => void;
}

export function FormulaBuilderDialog({
  open,
  onOpenChange,
  availableColumns,
  initialFormula,
  onSave,
  onCancel,
}: FormulaBuilderDialogProps) {
  const [fn, setFn] = useState<FormulaFunction>(initialFormula?.type ?? 'sum');
  const [references, setReferences] = useState<string[]>(initialFormula?.references ?? []);

  const toggleReference = (columnId: string) => {
    setReferences((prev) =>
      prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId]
    );
  };

  const previewFormula: ColumnFormula = useMemo(
    () => ({ type: fn, references }),
    [fn, references]
  );

  // Sample preview using placeholder numbers (1, 2, 3, ...) so the user sees
  // the function behavior before any real data exists.
  const previewResult = useMemo(() => {
    const sampleValues = new Map(references.map((id, i) => [id, (i + 1) * 10]));
    return evaluateFormula(previewFormula, (id) => sampleValues.get(id) ?? null);
  }, [previewFormula, references]);

  const canSave = references.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ type: fn, references });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Computed column</DialogTitle>
          <DialogDescription>
            Pick a function and the number columns it should use. This column updates automatically and can&apos;t be edited directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Function</label>
            <GridSelect
              value={fn}
              onChange={(value) => setFn(value as FormulaFunction)}
              className="h-9 text-sm border border-gray-200 rounded-md"
              options={FORMULA_FUNCTIONS.map((f) => ({ label: FUNCTION_LABELS[f], value: f }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Columns</label>
            {availableColumns.length === 0 ? (
              <p className="text-sm text-gray-500">
                Add at least one Number column before creating a computed column.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {availableColumns.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={references.includes(col.id)}
                      onChange={() => toggleReference(col.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="truncate">{col.name || 'Untitled column'}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {references.length > 0 && (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
              <span className="text-gray-500">Example result: </span>
              <span className="font-mono font-medium text-gray-900">
                {formatFormulaResult(previewResult, previewFormula)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save formula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
