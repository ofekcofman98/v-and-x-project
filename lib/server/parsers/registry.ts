/**
 * Schema-Driven Column Type Parser Registry (Strategy Pattern).
 * docs/features/10_voice-pipeline-hardening.md §4.1
 *
 * Replaces the `switch(column.type)` normalizeValue() duplicated in both
 * the voice-entry and parse services with a single registry, mirroring the
 * matcher chain's pattern language.
 */

import { ColumnType } from '@/lib/shared/types/column-types';
import type { ColumnValidation } from '@/lib/shared/types/table-schema';
import { parseBoolean } from './boolean-parser';
import { parseNaturalDate } from './date-parser';
import { parseSpokenNumber } from './number-parser';
import { parseText } from './text-parser';
import { validateValue } from './value-parsers';

export interface ParseContext {
  /** From Whisper's detected/declared language. */
  language: 'he' | 'en' | 'auto';
  validation?: ColumnValidation;
}

export interface ValueParser<T = unknown> {
  readonly type: ColumnType;
  /** Returns null when unparseable → caller sets valueValid: false. */
  parse(raw: unknown, ctx: ParseContext): T | null;
}

class NumberParser implements ValueParser<number> {
  readonly type = ColumnType.NUMBER;
  parse(raw: unknown, ctx: ParseContext): number | null {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw !== 'string') return null;
    return parseSpokenNumber(raw, ctx.language);
  }
}

class BooleanParser implements ValueParser<boolean> {
  readonly type = ColumnType.BOOLEAN;
  parse(raw: unknown): boolean | null {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw !== 'string') return null;
    return parseBoolean(raw);
  }
}

class DateParser implements ValueParser<string> {
  readonly type = ColumnType.DATE;
  parse(raw: unknown): string | null {
    if (raw instanceof Date) return raw.toISOString();
    if (typeof raw !== 'string') return null;
    const date = parseNaturalDate(raw);
    return date ? date.toISOString() : null;
  }
}

class TextParser implements ValueParser<string> {
  readonly type = ColumnType.TEXT;
  parse(raw: unknown): string | null {
    if (typeof raw === 'string') return parseText(raw);
    if (raw === null || raw === undefined) return null;
    return String(raw);
  }
}

const registry = new Map<ColumnType, ValueParser>([
  [ColumnType.NUMBER, new NumberParser()],
  [ColumnType.BOOLEAN, new BooleanParser()],
  [ColumnType.DATE, new DateParser()],
  [ColumnType.TEXT, new TextParser()],
]);

export interface ParseForColumnResult {
  value: unknown;
  valid: boolean;
  error?: string;
}

/**
 * Parses a raw value for the given column's type and validates it against
 * the column's validation rules in one pass.
 */
export function parseForColumn(
  raw: unknown,
  column: { type: ColumnType; validation?: ColumnValidation },
  ctx: ParseContext
): ParseForColumnResult {
  if (raw === null || raw === undefined) {
    const validation = validateValue(null, column.type, column.validation);
    return { value: null, ...validation };
  }

  const parser = registry.get(column.type) ?? registry.get(ColumnType.TEXT)!;
  const value = parser.parse(raw, ctx);

  // A non-null `raw` that the parser couldn't interpret is a bad value, not
  // an absent one — always invalid, regardless of `required`. validateValue's
  // null-handling is for the "nothing submitted" case (checked above).
  if (value === null) {
    return { value: null, valid: false, error: `Could not parse value for ${column.type} column` };
  }

  const validation = validateValue(value, column.type, column.validation);
  return { value: validation.valid ? value : null, ...validation };
}
