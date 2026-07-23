import { describe, it, expect } from 'vitest';
import { resolveBareValueEntry } from './bare-value';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { ParseContext } from '@/lib/server/parsers/registry';

const enCtx: ParseContext = { language: 'en' };
const activeRow = { label: 'Noa Cohen' };

describe('resolveBareValueEntry', () => {
  it('resolves a bare digit string for a NUMBER column', () => {
    const result = resolveBareValueEntry('21', { type: ColumnType.NUMBER }, activeRow, enCtx);
    expect(result).toEqual({ matched: 'Noa Cohen', value: 21 });
  });

  it('resolves a spoken number for a NUMBER column', () => {
    const result = resolveBareValueEntry('eighty five', { type: ColumnType.NUMBER }, activeRow, enCtx);
    expect(result).toEqual({ matched: 'Noa Cohen', value: 85 });
  });

  it('resolves a bare boolean word for a BOOLEAN column', () => {
    const result = resolveBareValueEntry('yes', { type: ColumnType.BOOLEAN }, activeRow, enCtx);
    expect(result).toEqual({ matched: 'Noa Cohen', value: true });
  });

  it('returns null for TEXT columns (deferred to LLM branch)', () => {
    const result = resolveBareValueEntry('Complete', { type: ColumnType.TEXT }, activeRow, enCtx);
    expect(result).toBeNull();
  });

  it('returns null when the bare value cannot be parsed for the column type', () => {
    const result = resolveBareValueEntry('asdf', { type: ColumnType.NUMBER }, activeRow, enCtx);
    expect(result).toBeNull();
  });
});
