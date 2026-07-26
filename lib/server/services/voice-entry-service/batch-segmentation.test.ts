import { describe, it, expect } from 'vitest';
import { segmentBareValuesLocal, segmentEntityValuePairsLocal } from './batch-segmentation';

describe('segmentBareValuesLocal', () => {
  it('splits a clean comma-separated multi-value transcript', () => {
    expect(segmentBareValuesLocal('85, 90, 78')).toEqual(['85', '90', '78']);
  });

  it('splits on "and" as well as commas', () => {
    expect(segmentBareValuesLocal('85 and 90')).toEqual(['85', '90']);
  });

  it('accepts non-numeric bare tokens (e.g. boolean/text columns)', () => {
    expect(segmentBareValuesLocal('present, absent')).toEqual(['present', 'absent']);
  });

  it('returns null when a segment carries more than one word (ambiguous)', () => {
    expect(segmentBareValuesLocal('Dan 85, 90')).toBeNull();
  });

  it('returns null for a single value (not a batch)', () => {
    expect(segmentBareValuesLocal('85')).toBeNull();
  });

  it('returns null for an empty transcript', () => {
    expect(segmentBareValuesLocal('')).toBeNull();
  });
});

describe('segmentEntityValuePairsLocal', () => {
  it('splits clean "Entity value" pairs separated by commas', () => {
    expect(segmentEntityValuePairsLocal('Dan 85, Noa 90, Yossi 78')).toEqual([
      { entityText: 'Dan', rawValue: '85' },
      { entityText: 'Noa', rawValue: '90' },
      { entityText: 'Yossi', rawValue: '78' },
    ]);
  });

  it('returns null when "Entity, value" pairs are comma-separated from each other too (ambiguous which comma is which)', () => {
    // "Dan, 85, Noa, 90" is genuinely ambiguous by comma-splitting alone —
    // falls back to LLM segmentation rather than guessing.
    expect(segmentEntityValuePairsLocal('Dan, 85, Noa, 90')).toBeNull();
  });

  it('splits pairs joined by "and"', () => {
    expect(segmentEntityValuePairsLocal('Dan 85 and Noa 90')).toEqual([
      { entityText: 'Dan', rawValue: '85' },
      { entityText: 'Noa', rawValue: '90' },
    ]);
  });

  it('returns null when a segment has no extractable value (ambiguous)', () => {
    expect(segmentEntityValuePairsLocal('Dan 85, Noa')).toBeNull();
  });

  it('returns null for a single pair (not a batch)', () => {
    expect(segmentEntityValuePairsLocal('Dan 85')).toBeNull();
  });

  it('returns null for an empty transcript', () => {
    expect(segmentEntityValuePairsLocal('')).toBeNull();
  });
});
