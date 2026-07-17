import { describe, expect, it } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';
import { detectColumnType } from './column-type-detector';

describe('detectColumnType', () => {
  it('detects NUMBER when every sample parses as a number', () => {
    expect(detectColumnType(['85', '92', '17.5'])).toBe(ColumnType.NUMBER);
  });

  it('detects BOOLEAN when every sample is a yes/no style value', () => {
    expect(detectColumnType(['yes', 'no', 'true', 'false'])).toBe(ColumnType.BOOLEAN);
  });

  it('detects DATE when every sample is a parseable date', () => {
    expect(detectColumnType(['2024-01-01', '2024-02-15'])).toBe(ColumnType.DATE);
  });

  it('falls back to TEXT when samples are mixed or unparseable', () => {
    expect(detectColumnType(['Alice', 'Bob', '42'])).toBe(ColumnType.TEXT);
  });

  it('falls back to TEXT for an all-empty column', () => {
    expect(detectColumnType(['', '  ', ''])).toBe(ColumnType.TEXT);
  });

  it('ignores empty samples when checking the rest for a consistent type', () => {
    expect(detectColumnType(['85', '', '92'])).toBe(ColumnType.NUMBER);
  });
});
