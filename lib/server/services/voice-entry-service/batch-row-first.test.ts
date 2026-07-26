import { describe, it, expect } from 'vitest';
import { resolveRowFirstColumnTargets } from './batch-row-first';

const tableSchema = {
  columns: [
    { id: 'entity', isBaseColumn: true },
    { id: 'math', isBaseColumn: false },
    { id: 'english', isBaseColumn: false },
    { id: 'science', isBaseColumn: false },
  ],
};

describe('resolveRowFirstColumnTargets', () => {
  it('returns an exact-fit set of targets with no overflow', () => {
    const result = resolveRowFirstColumnTargets({ tableColumnId: 'math' }, tableSchema, 3);

    expect(result.targets.map((c) => c.id)).toEqual(['math', 'english', 'science']);
    expect(result.overflowCount).toBe(0);
  });

  it('caps targets at row end and reports overflow when count exceeds remaining columns', () => {
    const result = resolveRowFirstColumnTargets({ tableColumnId: 'english' }, tableSchema, 3);

    expect(result.targets.map((c) => c.id)).toEqual(['english', 'science']);
    expect(result.overflowCount).toBe(1);
  });

  it('starts mid-row correctly', () => {
    const result = resolveRowFirstColumnTargets({ tableColumnId: 'science' }, tableSchema, 1);

    expect(result.targets.map((c) => c.id)).toEqual(['science']);
    expect(result.overflowCount).toBe(0);
  });

  it('skips base columns entirely', () => {
    const result = resolveRowFirstColumnTargets({ tableColumnId: 'math' }, tableSchema, 5);

    expect(result.targets.map((c) => c.id)).not.toContain('entity');
    expect(result.overflowCount).toBe(2);
  });

  it('when the active cell is the last editable column, only itself is a target and the rest overflow', () => {
    const result = resolveRowFirstColumnTargets({ tableColumnId: 'science' }, tableSchema, 3);

    expect(result.targets.map((c) => c.id)).toEqual(['science']);
    expect(result.overflowCount).toBe(2);
  });

  it('returns empty targets with full overflow if the active cell is not found among editable columns', () => {
    const result = resolveRowFirstColumnTargets({ tableColumnId: 'unknown' }, tableSchema, 2);

    expect(result.targets).toEqual([]);
    expect(result.overflowCount).toBe(2);
  });
});
