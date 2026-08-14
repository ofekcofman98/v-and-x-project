import { describe, it, expect } from 'vitest';
import { stripMarkdown } from './strip-markdown';

describe('stripMarkdown', () => {
  it('strips bold entity names, keeping the text', () => {
    expect(stripMarkdown('**Monica Geller**: 98 in Question 2')).toBe('Monica Geller: 98 in Question 2');
  });

  it('strips italics', () => {
    expect(stripMarkdown('This is *important*.')).toBe('This is important.');
  });

  it('strips inline code', () => {
    expect(stripMarkdown('Set `status` to Absent.')).toBe('Set status to Absent.');
  });

  it('strips heading markers', () => {
    expect(stripMarkdown('# Summary\nAll good.')).toBe('Summary. All good.');
  });

  it('strips bullet list markers and joins items as sentences', () => {
    expect(stripMarkdown('* Rachel Green: 72\n* Noa Cohen: 33')).toBe('Rachel Green: 72. Noa Cohen: 33.');
  });

  it('strips numbered list markers', () => {
    expect(stripMarkdown('1. First\n2. Second')).toBe('First. Second.');
  });

  it('does not double a trailing period', () => {
    expect(stripMarkdown('Line one.\nLine two.')).toBe('Line one. Line two.');
  });

  it('passes plain text through unchanged', () => {
    expect(stripMarkdown('98 in Question 2')).toBe('98 in Question 2');
  });
});
