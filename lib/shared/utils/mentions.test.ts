import { describe, expect, it } from 'vitest';
import {
  findActiveMentionQuery,
  insertMentionText,
  removeMentionText,
  resolveMentions,
} from './mentions';

const ID_A = '11111111-1111-1111-1111-111111111111';
const ID_B = '22222222-2222-2222-2222-222222222222';

describe('insertMentionText', () => {
  it('replaces the active @query with clean display text only — no id in the text', () => {
    const raw = 'Create a table for @Cla';
    const caretPos = raw.length;
    const { next, nextCaret } = insertMentionText(raw, caretPos, 'Cla', { id: ID_A, name: 'ClassA1' });

    expect(next).toBe('Create a table for @ClassA1 ');
    expect(next).not.toContain(ID_A);
    expect(next).not.toContain('baseList');
    expect(nextCaret).toBe(next.length);
  });

  it('preserves trailing text after the caret', () => {
    const raw = 'Create a table for @Cla with columns';
    const caretPos = 'Create a table for @Cla'.length;
    const { next } = insertMentionText(raw, caretPos, 'Cla', { id: ID_A, name: 'ClassA1' });

    expect(next).toBe('Create a table for @ClassA1  with columns');
  });
});

describe('removeMentionText', () => {
  it('removes the @Name occurrence and its trailing space', () => {
    const raw = 'Create a table for @ClassA1 with columns';
    const next = removeMentionText(raw, 'ClassA1');

    expect(next).toBe('Create a table for with columns');
  });

  it('is a no-op when the name is not present', () => {
    const raw = 'Create a table for students';
    expect(removeMentionText(raw, 'ClassA1')).toBe(raw);
  });
});

describe('resolveMentions', () => {
  it('returns no mentions for plain text with no chips', () => {
    const result = resolveMentions('Create a table for students', []);
    expect(result.mentions).toEqual([]);
    expect(result.chips).toEqual([]);
  });

  it('resolves a chip whose @Name is still present in the text', () => {
    const raw = 'Create a grade table for @ClassA1 with columns Test1';
    const result = resolveMentions(raw, [{ id: ID_A, name: 'ClassA1' }]);

    expect(result.mentions).toEqual([{ type: 'baseList', id: ID_A }]);
    expect(result.chips).toEqual([{ id: ID_A, name: 'ClassA1' }]);
  });

  it('drops a chip whose @Name was manually deleted from the text', () => {
    const raw = 'Create a table for students';
    const result = resolveMentions(raw, [{ id: ID_A, name: 'ClassA1' }]);

    expect(result.mentions).toEqual([]);
    expect(result.chips).toEqual([]);
  });

  it('dedupes repeated chips referencing the same id', () => {
    const raw = 'Create a table for @ClassA1';
    const result = resolveMentions(raw, [
      { id: ID_A, name: 'ClassA1' },
      { id: ID_A, name: 'ClassA1' },
    ]);

    expect(result.mentions).toHaveLength(1);
    expect(result.chips).toHaveLength(1);
  });

  it('caps mentions at 5, ignoring the rest', () => {
    const chips = Array.from({ length: 7 }, (_, i) => ({ id: `id-${i}`, name: `List${i}` }));
    const raw = chips.map((c) => `@${c.name}`).join(' ');
    const result = resolveMentions(raw, chips);

    expect(result.mentions).toHaveLength(5);
    expect(result.chips).toHaveLength(5);
  });

  it('never exposes an id inside the resolved chip names', () => {
    const raw = 'Create a table for @ClassA1';
    const result = resolveMentions(raw, [{ id: ID_B, name: 'ClassA1' }]);
    expect(result.chips[0].name).toBe('ClassA1');
    expect(result.chips[0].name).not.toContain(ID_B);
  });
});

describe('findActiveMentionQuery', () => {
  it('detects an in-progress @query right before the caret', () => {
    const raw = 'Create a table for @Cla';
    expect(findActiveMentionQuery(raw, raw.length)).toBe('Cla');
  });

  it('returns null when the caret is not inside a mention', () => {
    const raw = 'Create a table for students';
    expect(findActiveMentionQuery(raw, raw.length)).toBeNull();
  });

  it('returns an empty string right after typing just "@"', () => {
    const raw = 'Create a table for @';
    expect(findActiveMentionQuery(raw, raw.length)).toBe('');
  });
});
