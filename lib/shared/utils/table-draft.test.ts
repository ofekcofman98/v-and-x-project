import { describe, expect, it } from 'vitest';
import { draftToColumnDefs } from './table-draft';
import type { TableDraft } from '@/lib/shared/types/ai';
import { ColumnType } from '@/lib/shared/types/column-types';

function makeDraft(overrides: Partial<TableDraft> = {}): TableDraft {
  return {
    name: 'Class A1 — Grades',
    description: null,
    baseListId: null,
    representativeColumnKey: 'test_1',
    columns: [
      { key: 'final_grade', label: 'FinalGrade', type: ColumnType.NUMBER, order: 2 },
      { key: 'test_1', label: 'Test1', type: ColumnType.NUMBER, order: 0 },
      { key: 'test_2', label: 'Test2', type: ColumnType.NUMBER, order: 1 },
    ],
    ...overrides,
  };
}

describe('draftToColumnDefs', () => {
  it('lowercases the ColumnType for each drafted column', () => {
    const { columns } = draftToColumnDefs(makeDraft());
    expect(columns.every((c) => c.type === 'number')).toBe(true);
  });

  it('sorts columns by their drafted order', () => {
    const { columns } = draftToColumnDefs(makeDraft());
    expect(columns.map((c) => c.id)).toEqual(['test_1', 'test_2', 'final_grade']);
  });

  it('marks every mapped column as user_defined and unlocked', () => {
    const { columns } = draftToColumnDefs(makeDraft());
    expect(columns.every((c) => c.metadata?.source === 'user_defined' && c.metadata?.locked === false)).toBe(true);
  });

  it('resolves the representative column id for a standalone table', () => {
    const { representativeColumnId } = draftToColumnDefs(makeDraft());
    expect(representativeColumnId).toBe('test_1');
  });

  it('falls back to the first column when representativeColumnKey has no match', () => {
    const { representativeColumnId } = draftToColumnDefs(
      makeDraft({ representativeColumnKey: 'does_not_exist' })
    );
    expect(representativeColumnId).toBe('test_1');
  });

  it('returns null representativeColumnId for a BaseList-bound draft', () => {
    const { representativeColumnId } = draftToColumnDefs(
      makeDraft({ baseListId: '11111111-1111-1111-1111-111111111111' })
    );
    expect(representativeColumnId).toBeNull();
  });
});
