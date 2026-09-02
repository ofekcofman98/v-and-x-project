import { describe, expect, it } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';
import { coerceCellValue } from './cell-value';

describe('coerceCellValue', () => {
  it('clears to null on empty string for any column type', () => {
    expect(coerceCellValue('', ColumnType.BOOLEAN)).toEqual({ ok: true, value: null });
    expect(coerceCellValue('', ColumnType.TEXT)).toEqual({ ok: true, value: null });
  });

  it('coerces recognized false-ish BOOLEAN input to false', () => {
    expect(coerceCellValue('no', ColumnType.BOOLEAN)).toEqual({ ok: true, value: false });
    expect(coerceCellValue('false', ColumnType.BOOLEAN)).toEqual({ ok: true, value: false });
    expect(coerceCellValue('לא', ColumnType.BOOLEAN)).toEqual({ ok: true, value: false });
    expect(coerceCellValue('x', ColumnType.BOOLEAN)).toEqual({ ok: true, value: false });
  });

  it('coerces recognized true-ish BOOLEAN input to true', () => {
    expect(coerceCellValue('yes', ColumnType.BOOLEAN)).toEqual({ ok: true, value: true });
    expect(coerceCellValue('v', ColumnType.BOOLEAN)).toEqual({ ok: true, value: true });
    expect(coerceCellValue('כן', ColumnType.BOOLEAN)).toEqual({ ok: true, value: true });
  });

  it('rejects unrecognized BOOLEAN input instead of guessing', () => {
    expect(coerceCellValue('banana', ColumnType.BOOLEAN)).toEqual({ ok: false });
  });

  it('passes TEXT input through unchanged', () => {
    expect(coerceCellValue('hello', ColumnType.TEXT)).toEqual({ ok: true, value: 'hello' });
  });
});
