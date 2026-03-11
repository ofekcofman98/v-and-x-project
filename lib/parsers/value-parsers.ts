import { parse as parseDate } from 'chrono-node';

// ═══════════════════════════════════════════════════════════
// NUMBER PARSER
// ═══════════════════════════════════════════════════════════
export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/,/g, '').trim();

  const wordToNumber: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  };

  const words = cleaned.toLowerCase().split(/\s+/);
  let wordTotal = 0;

  for (const word of words) {
    if (word in wordToNumber) {
      wordTotal = wordTotal === 0 ? wordToNumber[word] : wordTotal + wordToNumber[word];
    }
  }

  if (wordTotal > 0) {
    return wordTotal;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// ═══════════════════════════════════════════════════════════
// BOOLEAN PARSER
// ═══════════════════════════════════════════════════════════
export function parseBoolean(input: string): boolean | null {
  const lower = input.toLowerCase().trim();
  const trueValues = ['yes', 'true', 'present', 'check', 'checked', '1', 'y'];
  const falseValues = ['no', 'false', 'absent', 'uncheck', 'unchecked', '0', 'n'];

  if (trueValues.includes(lower)) return true;
  if (falseValues.includes(lower)) return false;

  return null;
}

// ═══════════════════════════════════════════════════════════
// DATE PARSER
// ═══════════════════════════════════════════════════════════
export function parseNaturalDate(input: string): Date | null {
  const results = parseDate(input);

  if (results.length > 0) {
    return results[0].start.date();
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// VALUE VALIDATOR
// ═══════════════════════════════════════════════════════════
export function validateValue(
  value: any,
  columnType: string,
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    required?: boolean;
  }
): { valid: boolean; error?: string } {
  if (value === null || value === undefined) {
    if (validation?.required) {
      return { valid: false, error: 'Value is required' };
    }
    return { valid: true };
  }

  switch (columnType) {
    case 'number':
      if (typeof value !== 'number') {
        return { valid: false, error: 'Must be a number' };
      }
      if (validation?.min !== undefined && value < validation.min) {
        return { valid: false, error: `Must be at least ${validation.min}` };
      }
      if (validation?.max !== undefined && value > validation.max) {
        return { valid: false, error: `Must be at most ${validation.max}` };
      }
      break;

    case 'text':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Must be text' };
      }
      if (validation?.minLength !== undefined && value.length < validation.minLength) {
        return { valid: false, error: `Must be at least ${validation.minLength} characters` };
      }
      if (validation?.maxLength !== undefined && value.length > validation.maxLength) {
        return { valid: false, error: `Must be at most ${validation.maxLength} characters` };
      }
      if (validation?.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          return { valid: false, error: 'Invalid format' };
        }
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Must be yes/no' };
      }
      break;

    case 'date':
      if (typeof value !== 'string' && !(value instanceof Date)) {
        return { valid: false, error: 'Must be a date' };
      }
      break;
  }

  return { valid: true };
}
