// lib/parsers/boolean-parser.ts
import { normalizeForMatching } from './text-normalizer';

const TRUE_SET = new Set([
  'yes', 'true', 'present', 'check', 'checked', 'done', 'complete', 'completed', 'correct', '1', 'y',
  'כן', 'נכון', 'חיובי', 'בוצע', 'הושלם', 'יש', 'נוכח', 'נוכחת', 'אישור', 'וי'
]);

const FALSE_SET = new Set([
  'no', 'false', 'absent', 'uncheck', 'unchecked', 'not done', 'incomplete', 'wrong', '0', 'n',
  'לא', 'שלילי', 'לא בוצע', 'חסר', 'חסרה', 'נעדר', 'נעדרת', 'ביטול', 'אין'
]);

export function parseBoolean(input: string): boolean | null {
  const normalized = normalizeForMatching(input);
  if (TRUE_SET.has(normalized)) return true;
  if (FALSE_SET.has(normalized)) return false;
  return null; // Return null to trigger validation error and not guess
}