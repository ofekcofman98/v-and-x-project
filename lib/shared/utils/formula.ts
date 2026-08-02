import { ColumnType } from '@/lib/shared/types/column-types';
import {
  DEFAULT_FORMULA_FALLBACK,
  DEFAULT_FORMULA_PRECISION,
  MAX_FORMULA_REFERENCES,
  type ColumnFormula,
  type FormulaValidationError,
} from '@/lib/shared/types/formula';

type CellValue = string | number | boolean | null | undefined;

function toNumericOrNull(value: CellValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Evaluates a computed column formula against a row's values.
 * Blank/non-numeric references are excluded; if none of the references
 * resolve to a number, the result is null (caller shows the fallback).
 */
export function evaluateFormula(
  formula: ColumnFormula,
  getValue: (columnId: string) => CellValue
): number | null {
  const numbers = formula.references
    .map((columnId) => toNumericOrNull(getValue(columnId)))
    .filter((n): n is number => n !== null);

  if (formula.type === 'count') {
    return numbers.length;
  }

  if (numbers.length === 0) return null;

  switch (formula.type) {
    case 'sum':
      return numbers.reduce((acc, n) => acc + n, 0);
    case 'average':
      return numbers.reduce((acc, n) => acc + n, 0) / numbers.length;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    default:
      return null;
  }
}

/** Formats an evaluated formula result for display, applying precision and fallback. */
export function formatFormulaResult(result: number | null, formula: ColumnFormula): string {
  if (result === null) return formula.fallback ?? DEFAULT_FORMULA_FALLBACK;

  const precision = formula.precision ?? DEFAULT_FORMULA_PRECISION;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  }).format(result);
}

/**
 * Validates a computed column's formula against the table's other columns.
 * References to other COMPUTED columns are rejected so circular dependencies
 * are structurally impossible.
 */
export function validateFormula(
  columnId: string,
  formula: ColumnFormula,
  columns: ReadonlyArray<{ id: string; type: ColumnType }>
): FormulaValidationError[] {
  const errors: FormulaValidationError[] = [];

  if (formula.references.length === 0) {
    errors.push({
      columnId,
      error: 'invalid_formula',
      message: 'A formula must reference at least one column',
    });
    return errors;
  }

  if (formula.references.length > MAX_FORMULA_REFERENCES) {
    errors.push({
      columnId,
      error: 'too_many_references',
      message: `A formula can reference at most ${MAX_FORMULA_REFERENCES} columns`,
    });
  }

  const columnsById = new Map(columns.map((col) => [col.id, col]));

  for (const refId of formula.references) {
    const refColumn = columnsById.get(refId);

    if (!refColumn) {
      errors.push({
        columnId,
        error: 'missing_reference',
        message: `Referenced column '${refId}' does not exist`,
      });
      continue;
    }

    if (refColumn.type === ColumnType.COMPUTED) {
      errors.push({
        columnId,
        error: 'invalid_type',
        message: `Computed columns cannot reference other computed columns ('${refId}')`,
      });
      continue;
    }

    if (refColumn.type !== ColumnType.NUMBER) {
      errors.push({
        columnId,
        error: 'invalid_type',
        message: `Referenced column '${refId}' must be a number column`,
      });
    }
  }

  return errors;
}
