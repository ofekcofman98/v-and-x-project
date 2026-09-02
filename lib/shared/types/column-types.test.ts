import { describe, expect, it } from 'vitest';
import { ColumnType, formatCellValue } from './column-types';

describe('formatCellValue — BOOLEAN', () => {
  it('renders real booleans as check/cross', () => {
    expect(formatCellValue(true, ColumnType.BOOLEAN)).toBe('✓');
    expect(formatCellValue(false, ColumnType.BOOLEAN)).toBe('✗');
  });

  it('parses legacy string values through the shared boolean vocabulary', () => {
    // Regression guard: before this fix, any non-empty string (including
    // "no"/"false") was truthy and rendered '✓'.
    expect(formatCellValue('no', ColumnType.BOOLEAN)).toBe('✗');
    expect(formatCellValue('false', ColumnType.BOOLEAN)).toBe('✗');
    expect(formatCellValue('yes', ColumnType.BOOLEAN)).toBe('✓');
  });

  it('renders unrecognized legacy strings as blank rather than a wrong ✓/✗', () => {
    expect(formatCellValue('banana', ColumnType.BOOLEAN)).toBe('');
  });

  it('renders null/undefined as blank', () => {
    expect(formatCellValue(null, ColumnType.BOOLEAN)).toBe('');
    expect(formatCellValue(undefined, ColumnType.BOOLEAN)).toBe('');
  });
});
