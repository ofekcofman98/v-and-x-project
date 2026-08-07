import { describe, it, expect } from 'vitest';
import { segmentBareValuesLocal, segmentEntityValuePairsLocal } from './batch-segmentation';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { ParseContext } from '@/lib/server/parsers/registry';

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

  it('recombines "Entity, value" pairs that are comma-separated from each other too, via alternation', () => {
    // "Dan, 85, Noa, 90" strictly alternates name/bare-number segments — the
    // natural "Name, value, Name, value" cadence — so it recombines locally
    // instead of falling back to the LLM.
    expect(segmentEntityValuePairsLocal('Dan, 85, Noa, 90')).toEqual([
      { entityText: 'Dan', rawValue: '85' },
      { entityText: 'Noa', rawValue: '90' },
    ]);
  });

  it('recombines a longer alternating list ("Rachel Green, 72, Noa Cohen, 33, ...")', () => {
    expect(
      segmentEntityValuePairsLocal(
        'Rachel Green, 72, Noa Cohen, 33, John Snow, 100, Chris Levi, 40'
      )
    ).toEqual([
      { entityText: 'Rachel Green', rawValue: '72' },
      { entityText: 'Noa Cohen', rawValue: '33' },
      { entityText: 'John Snow', rawValue: '100' },
      { entityText: 'Chris Levi', rawValue: '40' },
    ]);
  });

  it('returns null for a Whisper list-numbering artifact ("26. Rachel Green, 85. Yossi Hertz, ...")', () => {
    // The leading digit here is a list marker, not a value — ambiguous by
    // construction on both the alternation and per-segment paths.
    expect(
      segmentEntityValuePairsLocal('26. Rachel Green, 85. Yossi Hertz, 26. John Snow, 100.')
    ).toBeNull();
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

  it('rejects a pair whose value cannot parse for the active NUMBER column', () => {
    const numberColumn = { type: ColumnType.NUMBER } as const;
    const ctx: ParseContext = { language: 'en' };
    // Two-segment input skips the (>=4-segment) recombination path and
    // falls to per-segment extraction, whose last-word pattern would
    // otherwise mis-extract "Green"/"Cohen" as the values.
    expect(segmentEntityValuePairsLocal('Rachel Green, Noa Cohen', numberColumn, ctx)).toBeNull();
  });

  it('accepts a recombined pair whose value parses for the active NUMBER column', () => {
    const numberColumn = { type: ColumnType.NUMBER } as const;
    const ctx: ParseContext = { language: 'en' };
    expect(segmentEntityValuePairsLocal('Dan, 85, Noa, 90', numberColumn, ctx)).toEqual([
      { entityText: 'Dan', rawValue: '85' },
      { entityText: 'Noa', rawValue: '90' },
    ]);
  });
});
