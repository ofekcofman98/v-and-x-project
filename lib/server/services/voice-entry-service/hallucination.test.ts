import { describe, it, expect } from 'vitest';
import { isWhisperHallucination, isDegenerateRepetition } from './hallucination';

describe('isWhisperHallucination', () => {
  it('flags empty transcripts', () => {
    expect(isWhisperHallucination('')).toBe(true);
  });

  it('flags a known hallucination phrase', () => {
    expect(isWhisperHallucination('Thank you.')).toBe(true);
  });

  it('flags punctuation-only transcripts', () => {
    expect(isWhisperHallucination('...')).toBe(true);
  });

  it('does not flag a real value', () => {
    expect(isWhisperHallucination('85')).toBe(false);
  });

  it('does not flag a real entity+value phrase', () => {
    expect(isWhisperHallucination('Noa Cohen, 21')).toBe(false);
  });

  it('flags a bare vocabulary echo on a near-silent clip', () => {
    expect(
      isWhisperHallucination('Noa Cohen', { audioDurationSec: 0.3, promptEntities: ['Noa Cohen'] })
    ).toBe(true);
  });

  it('does not flag a bare vocabulary echo when the clip is not near-silent', () => {
    expect(
      isWhisperHallucination('Noa Cohen', { audioDurationSec: 2, promptEntities: ['Noa Cohen'] })
    ).toBe(false);
  });
});

describe('isDegenerateRepetition', () => {
  it('flags a long single-token repetition loop', () => {
    const transcript = 'no, ' + Array(30).fill('nie').join(', ') + '.';
    expect(isDegenerateRepetition(transcript)).toBe(true);
  });

  it('does not flag a short real phrase', () => {
    expect(isDegenerateRepetition('Noa Cohen, 21.')).toBe(false);
  });

  it('does not flag a bare short value', () => {
    expect(isDegenerateRepetition('85')).toBe(false);
  });

  it('does not flag a short, legitimately repeated word', () => {
    expect(isDegenerateRepetition('no no no')).toBe(false);
  });
});
