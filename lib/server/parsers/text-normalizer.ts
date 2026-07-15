/**
 * Normalizes free-text input for value-set lookups (boolean parsing, etc.):
 * lowercase, trimmed, internal whitespace collapsed to a single space.
 */
export function normalizeForMatching(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}
