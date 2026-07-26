import { describe, it, expect } from 'vitest';
import { looksLikeBatchUtterance } from './batch-detect';

describe('looksLikeBatchUtterance', () => {
  it('is false for an empty transcript', () => {
    expect(looksLikeBatchUtterance('')).toBe(false);
    expect(looksLikeBatchUtterance('   ')).toBe(false);
  });

  it('is false for a bare single value', () => {
    expect(looksLikeBatchUtterance('85')).toBe(false);
  });

  it('is false for a single entity + value', () => {
    expect(looksLikeBatchUtterance('Dan 85')).toBe(false);
    expect(looksLikeBatchUtterance('Dan, 85')).toBe(false);
  });

  it('is false for commas without a second number (e.g. a name with a comma-less qualifier)', () => {
    expect(looksLikeBatchUtterance('present, absent')).toBe(false);
  });

  it('is true for a row-first bare-value sequence', () => {
    expect(looksLikeBatchUtterance('85, 90, 78')).toBe(true);
  });

  it('is true for a row-first bare-value sequence without commas', () => {
    expect(looksLikeBatchUtterance('85 90 78')).toBe(true);
  });

  it('is true for a column-first entity+value sequence', () => {
    expect(looksLikeBatchUtterance('Dan 85, Noa 90, Yossi 78')).toBe(true);
  });

  it('is true when segments are joined with "and" instead of commas', () => {
    expect(looksLikeBatchUtterance('Dan 85 and Noa 90')).toBe(true);
  });

  it('is false when only one of multiple comma segments has a number', () => {
    expect(looksLikeBatchUtterance('Dan, present, 85')).toBe(false);
  });
});
