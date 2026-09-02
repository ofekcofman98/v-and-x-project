import { ColumnType } from '@/lib/shared/types/column-types';
import { parseBoolean } from '@/lib/shared/parsers/boolean-parser';
import { parseNaturalDate } from './date-parser';
import { parseSpokenNumber } from './number-parser';

const PURELY_NUMERIC = /^\d+(\.\d+)?$/;

// Checked in this order: BOOLEAN is narrowest (avoids a "0"/"1"-only column
// registering as NUMBER). DATE comes before NUMBER but is guarded to skip
// purely-numeric samples ("2024") — parseSpokenNumber's digit-extraction
// fallback would otherwise mis-turn a plain date like "2024-01-01" into the
// number 2024 before DATE gets a chance to look at it. TEXT is the
// always-matching fallback, so it's never actually "tried".
const DETECTION_ORDER: ColumnType[] = [ColumnType.BOOLEAN, ColumnType.DATE, ColumnType.NUMBER];

const CHECKERS: Record<Exclude<ColumnType, ColumnType.TEXT | ColumnType.COMPUTED>, (sample: string) => boolean> = {
  [ColumnType.BOOLEAN]: (sample) => parseBoolean(sample) !== null,
  [ColumnType.NUMBER]: (sample) => parseSpokenNumber(sample, 'auto') !== null,
  [ColumnType.DATE]: (sample) => !PURELY_NUMERIC.test(sample) && parseNaturalDate(sample) !== null,
};

/**
 * Infers the best-fit ColumnType for a CSV column from its sample string
 * values. A type is chosen only when every non-empty sample parses under
 * it; otherwise falls back to TEXT (which always matches).
 */
export function detectColumnType(samples: string[]): ColumnType {
  const nonEmpty = samples.map((s) => s.trim()).filter((s) => s.length > 0);
  if (nonEmpty.length === 0) return ColumnType.TEXT;

  for (const type of DETECTION_ORDER) {
    const checker = CHECKERS[type as Exclude<ColumnType, ColumnType.TEXT | ColumnType.COMPUTED>];
    if (nonEmpty.every(checker)) return type;
  }

  return ColumnType.TEXT;
}
