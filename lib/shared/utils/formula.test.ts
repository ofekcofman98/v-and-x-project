import { describe, expect, it } from 'vitest';
import { evaluateFormula, formatFormulaResult, validateFormula } from './formula';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { ColumnFormula } from '@/lib/shared/types/formula';

const values: Record<string, string | number | boolean | null> = {
  a: 10,
  b: 20,
  c: 30,
  blank: '',
  nullish: null,
  text: 'not a number',
  numericString: '5',
};
const getValue = (columnId: string) => values[columnId];

describe('evaluateFormula', () => {
  it('sums the referenced values', () => {
    const formula: ColumnFormula = { type: 'sum', references: ['a', 'b', 'c'] };
    expect(evaluateFormula(formula, getValue)).toBe(60);
  });

  it('averages the referenced values', () => {
    const formula: ColumnFormula = { type: 'average', references: ['a', 'b', 'c'] };
    expect(evaluateFormula(formula, getValue)).toBe(20);
  });

  it('counts non-empty numeric values', () => {
    const formula: ColumnFormula = { type: 'count', references: ['a', 'blank', 'c'] };
    expect(evaluateFormula(formula, getValue)).toBe(2);
  });

  it('finds min and max', () => {
    expect(evaluateFormula({ type: 'min', references: ['a', 'b', 'c'] }, getValue)).toBe(10);
    expect(evaluateFormula({ type: 'max', references: ['a', 'b', 'c'] }, getValue)).toBe(30);
  });

  it('excludes blank cells from sum/average', () => {
    const formula: ColumnFormula = { type: 'average', references: ['a', 'blank', 'c'] };
    expect(evaluateFormula(formula, getValue)).toBe(20);
  });

  it('excludes null and non-numeric cells', () => {
    const formula: ColumnFormula = { type: 'sum', references: ['a', 'nullish', 'text'] };
    expect(evaluateFormula(formula, getValue)).toBe(10);
  });

  it('coerces numeric strings', () => {
    const formula: ColumnFormula = { type: 'sum', references: ['a', 'numericString'] };
    expect(evaluateFormula(formula, getValue)).toBe(15);
  });

  it('returns null for sum/average when every reference is blank', () => {
    const formula: ColumnFormula = { type: 'average', references: ['blank', 'nullish', 'text'] };
    expect(evaluateFormula(formula, getValue)).toBeNull();
  });

  it('returns 0 for count when every reference is blank', () => {
    const formula: ColumnFormula = { type: 'count', references: ['blank', 'nullish'] };
    expect(evaluateFormula(formula, getValue)).toBe(0);
  });
});

describe('formatFormulaResult', () => {
  it('formats with the default precision', () => {
    const formula: ColumnFormula = { type: 'average', references: ['a'] };
    expect(formatFormulaResult(12.5, formula)).toBe('12.5');
    expect(formatFormulaResult(12.567, formula)).toBe('12.57');
  });

  it('respects an explicit precision', () => {
    const formula: ColumnFormula = { type: 'average', references: ['a'], precision: 0 };
    expect(formatFormulaResult(12.5, formula)).toBe('13');
  });

  it('shows the fallback when the result is null', () => {
    const formula: ColumnFormula = { type: 'average', references: ['a'] };
    expect(formatFormulaResult(null, formula)).toBe('—');
  });

  it('shows a custom fallback', () => {
    const formula: ColumnFormula = { type: 'average', references: ['a'], fallback: 'n/a' };
    expect(formatFormulaResult(null, formula)).toBe('n/a');
  });
});

describe('validateFormula', () => {
  const columns = [
    { id: 'a', type: ColumnType.NUMBER },
    { id: 'b', type: ColumnType.NUMBER },
    { id: 'text_col', type: ColumnType.TEXT },
    { id: 'computed_col', type: ColumnType.COMPUTED },
  ];

  it('passes for a valid formula', () => {
    const formula: ColumnFormula = { type: 'sum', references: ['a', 'b'] };
    expect(validateFormula('total', formula, columns)).toEqual([]);
  });

  it('flags a missing reference', () => {
    const formula: ColumnFormula = { type: 'sum', references: ['missing'] };
    const errors = validateFormula('total', formula, columns);
    expect(errors).toEqual([
      { columnId: 'total', error: 'missing_reference', message: expect.any(String) },
    ]);
  });

  it('flags a non-numeric reference', () => {
    const formula: ColumnFormula = { type: 'sum', references: ['text_col'] };
    const errors = validateFormula('total', formula, columns);
    expect(errors[0]).toMatchObject({ columnId: 'total', error: 'invalid_type' });
  });

  it('rejects references to other computed columns', () => {
    const formula: ColumnFormula = { type: 'sum', references: ['computed_col'] };
    const errors = validateFormula('total', formula, columns);
    expect(errors[0]).toMatchObject({ columnId: 'total', error: 'invalid_type' });
  });

  it('flags zero references', () => {
    const formula: ColumnFormula = { type: 'sum', references: [] };
    const errors = validateFormula('total', formula, columns);
    expect(errors[0]).toMatchObject({ columnId: 'total', error: 'invalid_formula' });
  });

  it('flags too many references', () => {
    const manyColumns = Array.from({ length: 11 }, (_, i) => ({ id: `c${i}`, type: ColumnType.NUMBER }));
    const formula: ColumnFormula = { type: 'sum', references: manyColumns.map((c) => c.id) };
    const errors = validateFormula('total', formula, manyColumns);
    expect(errors.some((e) => e.error === 'too_many_references')).toBe(true);
  });
});
