// lib/parsers/boolean-parser.ts
import { normalizeText } from './text-normalizer';

const TRUE_SET = new Set([
  'yes', 'true', 'present', 'here', 'check', 'checked', 'done', 'complete', 'completed', 'correct', '1', 'y',
  'כן', 'נכון', 'חיובי', 'בוצע', 'הושלם', 'יש', 'נוכח', 'נוכחת', 'כאן', 'אישור', 'וי'
]);

const FALSE_SET = new Set([
  'no', 'false', 'absent', 'not here', 'uncheck', 'unchecked', 'not done', 'incomplete', 'wrong', '0', 'n',
  'לא', 'שלילי', 'לא בוצע', 'חסר', 'חסרה', 'נעדר', 'נעדרת', 'לא כאן', 'ביטול', 'אין'
]);

export function parseBoolean(input: string): boolean | null {
  // Plain normalizeText — not normalizeForMatching. Final-letter folding is
  // for fuzzy/cache-key matching only; it would turn "כן" into "כנ" and
  // silently break exact-set membership here.
  const normalized = normalizeText(input).toLowerCase();
  if (TRUE_SET.has(normalized)) return true;
  if (FALSE_SET.has(normalized)) return false;
  return null; // Return null to trigger validation error and not guess
}