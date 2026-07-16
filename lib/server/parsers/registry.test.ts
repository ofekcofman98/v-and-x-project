import { describe, expect, it } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';
import { parseSpokenNumber } from './number-parser';
import { parseBoolean } from './boolean-parser';
import { normalizeText, normalizeForMatching } from './text-normalizer';
import { parseForColumn } from './registry';

describe('parseSpokenNumber', () => {
  it('parses multi-word EN numbers with hundred/thousand multipliers', () => {
    expect(parseSpokenNumber('one hundred fifty six', 'en')).toBe(156);
    expect(parseSpokenNumber('eighty five', 'en')).toBe(85);
    expect(parseSpokenNumber('two thousand twenty four', 'en')).toBe(2024);
  });

  it('parses HE numbers including irregular scales and conjunction prefix', () => {
    expect(parseSpokenNumber('מאה חמישים ושש', 'he')).toBe(156);
    expect(parseSpokenNumber('מאתיים', 'he')).toBe(200);
    expect(parseSpokenNumber('אלפיים', 'he')).toBe(2000);
    expect(parseSpokenNumber('שלוש מאות', 'he')).toBe(300);
  });

  it('falls back to digit parsing', () => {
    expect(parseSpokenNumber('156', 'auto')).toBe(156);
    expect(parseSpokenNumber('156.5', 'auto')).toBe(156.5);
  });

  it('returns null for unparseable input', () => {
    expect(parseSpokenNumber('banana', 'en')).toBeNull();
  });
});

describe('parseBoolean', () => {
  it('matches EN and HE true/false sets exactly', () => {
    expect(parseBoolean('yes')).toBe(true);
    expect(parseBoolean('כן')).toBe(true);
    expect(parseBoolean('no')).toBe(false);
    expect(parseBoolean('לא')).toBe(false);
  });

  it('never fuzzily guesses', () => {
    expect(parseBoolean('maybe')).toBeNull();
  });
});

describe('normalizeText / normalizeForMatching', () => {
  it('strips niqqud and trailing punctuation', () => {
    expect(normalizeText('שָׁלוֹם.')).toBe('שלום');
  });

  it('folds Hebrew final letters for matching', () => {
    expect(normalizeForMatching('דוד לוי')).toBe('דוד לוי');
    // final mem (ם) folds to medial mem (מ) — intentional, for cache-key/fuzzy
    // matching only, never for stored values.
    expect(normalizeForMatching('שלום')).toBe('שלומ');
  });
});

describe('parseForColumn', () => {
  it('parses and validates a NUMBER column', () => {
    const result = parseForColumn('eighty five', { type: ColumnType.NUMBER }, { language: 'en' });
    expect(result).toEqual({ value: 85, valid: true });
  });

  it('marks unparseable values invalid', () => {
    const result = parseForColumn('banana', { type: ColumnType.NUMBER }, { language: 'en' });
    expect(result.valid).toBe(false);
    expect(result.value).toBeNull();
  });

  it('passes through null with required validation', () => {
    const result = parseForColumn(null, { type: ColumnType.TEXT, validation: { required: true } }, { language: 'auto' });
    expect(result.valid).toBe(false);
  });
});
