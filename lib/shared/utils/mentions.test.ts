import { describe, expect, it } from 'vitest';
import {
  findActiveMentionQuery,
  insertMentionToken,
  parseMentions,
  removeMentionToken,
} from './mentions';

const ID_A = '11111111-1111-1111-1111-111111111111';
const ID_B = '22222222-2222-2222-2222-222222222222';

describe('parseMentions', () => {
  it('returns the raw text unchanged when there are no mention tokens', () => {
    const result = parseMentions('Create a table for students');
    expect(result.prompt).toBe('Create a table for students');
    expect(result.mentions).toEqual([]);
    expect(result.chips).toEqual([]);
  });

  it('strips a mention token into display text and a resolved mention', () => {
    const raw = `Create a grade table for @[ClassA1](baseList:${ID_A}) with columns Test1`;
    const result = parseMentions(raw);

    expect(result.prompt).toBe('Create a grade table for @ClassA1 with columns Test1');
    expect(result.mentions).toEqual([{ type: 'baseList', id: ID_A }]);
    expect(result.chips).toEqual([{ id: ID_A, name: 'ClassA1' }]);
  });

  it('dedupes repeated mentions of the same base list', () => {
    const raw = `@[ClassA1](baseList:${ID_A}) and again @[ClassA1](baseList:${ID_A})`;
    const result = parseMentions(raw);

    expect(result.mentions).toHaveLength(1);
    expect(result.chips).toHaveLength(1);
  });

  it('caps mentions at 5, ignoring the rest', () => {
    const ids = Array.from({ length: 7 }, (_, i) => `3333333${i}-3333-3333-3333-333333333333`);
    const raw = ids.map((id, i) => `@[List${i}](baseList:${id})`).join(' ');
    const result = parseMentions(raw);

    expect(result.mentions).toHaveLength(5);
    expect(result.chips).toHaveLength(5);
  });
});

describe('insertMentionToken', () => {
  it('replaces the active @query with a mention token', () => {
    const raw = 'Create a table for @Cla';
    const caretPos = raw.length;
    const { next, nextCaret } = insertMentionToken(raw, caretPos, 'Cla', { id: ID_A, name: 'ClassA1' });

    expect(next).toBe(`Create a table for @[ClassA1](baseList:${ID_A})`);
    expect(nextCaret).toBe(next.length);
  });

  it('preserves trailing text after the caret', () => {
    const raw = 'Create a table for @Cla with columns';
    const caretPos = 'Create a table for @Cla'.length;
    const { next } = insertMentionToken(raw, caretPos, 'Cla', { id: ID_A, name: 'ClassA1' });

    expect(next).toBe(`Create a table for @[ClassA1](baseList:${ID_A}) with columns`);
  });
});

describe('removeMentionToken', () => {
  it('removes the token matching the given id and leaves others intact', () => {
    const raw = `@[ClassA1](baseList:${ID_A}) and @[ClassB1](baseList:${ID_B})`;
    const next = removeMentionToken(raw, ID_A);

    expect(next).toBe(` and @[ClassB1](baseList:${ID_B})`);
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
