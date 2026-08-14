import { describe, it, expect } from 'vitest';
import { truncateAtSentence, MAX_SPEAK_CHARS } from './truncate-at-sentence';

describe('truncateAtSentence', () => {
  it('returns text unchanged when under the cap', () => {
    expect(truncateAtSentence('Short answer.', 500)).toBe('Short answer.');
  });

  it('trims surrounding whitespace even when under the cap', () => {
    expect(truncateAtSentence('  Short answer.  ', 500)).toBe('Short answer.');
  });

  it('cuts at the last sentence boundary under the cap', () => {
    const text = 'First sentence. Second sentence. Third sentence that gets cut off here.';
    const result = truncateAtSentence(text, 40);
    expect(result).toBe('First sentence. Second sentence.');
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it('hard-cuts at maxChars when no sentence boundary exists under the cap', () => {
    const text = 'a'.repeat(600);
    const result = truncateAtSentence(text, 500);
    expect(result.length).toBe(500);
  });

  it('defaults to MAX_SPEAK_CHARS when no cap is given', () => {
    const text = 'a'.repeat(600);
    expect(truncateAtSentence(text).length).toBe(MAX_SPEAK_CHARS);
  });
});
