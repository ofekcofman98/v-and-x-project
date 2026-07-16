import { ColumnType } from '@/lib/shared/types/column-types';
import type { ColumnValidation } from '@/lib/shared/types/table-schema';

// ═══════════════════════════════════════════════════════════
// VALUE VALIDATOR
// ═══════════════════════════════════════════════════════════
export function validateValue(
  value: unknown,
  columnType: ColumnType | string,
  validation?: ColumnValidation
): { valid: boolean; error?: string } {
  if (value === null || value === undefined) {
    if (validation?.required) {
      return { valid: false, error: 'Value is required' };
    }
    return { valid: true };
  }

  switch (columnType) {
    case ColumnType.NUMBER:
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

    case ColumnType.TEXT:
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

    case ColumnType.BOOLEAN:
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Must be yes/no' };
      }
      break;

    case ColumnType.DATE:
    case 'date':
      if (typeof value !== 'string' && !(value instanceof Date)) {
        return { valid: false, error: 'Must be a date' };
      }
      break;
  }

  return { valid: true };
}
