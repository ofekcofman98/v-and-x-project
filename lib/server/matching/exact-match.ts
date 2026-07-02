import type { Matcher, MatchResult } from './types';

/**
 * Exact match (case-insensitive, whitespace-normalized)
 */
export class ExactMatcher implements Matcher {
  readonly name = 'exact';

  match(input: string, entities: string[]): MatchResult {
    const normalized = this.normalizeString(input);
    
    for (const entity of entities) {
      if (this.normalizeString(entity) === normalized) {
        return {
          matched: entity,
          confidence: 1.0,
          matchType: 'exact',
        };
      }
    }
    
    return this.noMatch();
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  private noMatch(): MatchResult {
    return {
      matched: null,
      confidence: 0,
      matchType: 'none',
    };
  }
}

/**
 * Legacy function for backward compatibility
 */
export function exactMatch(input: string, entities: string[]): MatchResult {
  return new ExactMatcher().match(input, entities);
}
