/**
 * Manual-edit-time coercion for a raw cell input string, keyed by ColumnType.
 * Single source of truth shared by the manual-edit path (DataTableCell) and
 * any future caller — the voice path already produces typed values via
 * lib/server/parsers/registry.ts's parseForColumn, which delegates its
 * BOOLEAN branch to the same lib/shared/parsers/boolean-parser.ts used here.
 */

import { ColumnType } from '@/lib/shared/types/column-types';
import { parseBoolean } from './boolean-parser';

export type CoerceResult =
  | { ok: true; value: string | boolean | null }
  | { ok: false };

/**
 * Coerces a raw `<input>` string into the value that should be persisted
 * for the given column type.
 *
 * - An empty string always means "clear the cell" → `null`.
 * - BOOLEAN runs through the same bilingual parseBoolean the voice pipeline
 *   uses, so typing "no" and saying "no" store the identical `false`.
 *   Unrecognized text (e.g. "banana") returns `{ ok: false }` so the caller
 *   can reject the edit rather than silently store a bad value.
 * - Every other column type is a pass-through — NUMBER/DATE coercion is
 *   deliberately out of scope here.
 */
export function coerceCellValue(raw: string, type: ColumnType): CoerceResult {
  if (raw === '') return { ok: true, value: null };

  if (type === ColumnType.BOOLEAN) {
    const parsed = parseBoolean(raw);
    return parsed === null ? { ok: false } : { ok: true, value: parsed };
  }

  return { ok: true, value: raw };
}
