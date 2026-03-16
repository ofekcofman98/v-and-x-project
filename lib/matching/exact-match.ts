export interface MatchResult {
  matched: string | null;
  confidence: number;
  matchType: 'exact' | 'phonetic' | 'fuzzy' | 'semantic' | 'none';
  candidates?: Array<{ entity: string; score: number }>;
}

/**
 * Exact match (case-insensitive, whitespace-normalized)
 */
export function exactMatch(
  input: string,
  entities: string[]
): MatchResult {
  const normalized = normalizeString(input);
  
  for (const entity of entities) {
    if (normalizeString(entity) === normalized) {
      return {
        matched: entity,
        confidence: 1.0,
        matchType: 'exact',
      };
    }
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
