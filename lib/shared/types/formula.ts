/**
 * Computed column formula types
 * Based on: docs/features/04_computed_columns.md
 */

export const FORMULA_FUNCTIONS = ['sum', 'average', 'count', 'min', 'max'] as const;
export type FormulaFunction = (typeof FORMULA_FUNCTIONS)[number];

export const MAX_FORMULA_REFERENCES = 10;
export const DEFAULT_FORMULA_PRECISION = 2;
export const DEFAULT_FORMULA_FALLBACK = '—';

export interface ColumnFormula {
  type: FormulaFunction;
  references: string[]; // referenced column ids, 1-10
  precision?: number; // decimal places, default DEFAULT_FORMULA_PRECISION
  fallback?: string; // shown when result is null, default DEFAULT_FORMULA_FALLBACK
}

export type FormulaValidationErrorCode =
  | 'missing_reference'
  | 'invalid_type'
  | 'invalid_formula'
  | 'too_many_references';

export interface FormulaValidationError {
  columnId: string;
  error: FormulaValidationErrorCode;
  message: string;
}
