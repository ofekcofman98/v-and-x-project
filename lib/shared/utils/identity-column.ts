/**
 * Heuristic for picking the "identity"/representative column out of a set of
 * BaseList or Table columns — e.g. for defaulting representativeColumnKey.
 */
export const IDENTITY_COLUMN_KEYS = new Set(['name', 'id', 'identifier', 'key']);

export function isIdentityColumn(col: { id: string; label: string }): boolean {
  const norm = (s: string): string => s.toLowerCase().trim();
  return IDENTITY_COLUMN_KEYS.has(norm(col.id)) || IDENTITY_COLUMN_KEYS.has(norm(col.label));
}
