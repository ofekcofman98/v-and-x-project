import type { MatchResult } from './exact-match';

/**
 * Match by first name only
 * Input: "john" → Matches: "John Smith", "John Doe"
 */
export function matchFirstName(
  input: string,
  entities: string[]
): MatchResult {
  const inputLower = input.toLowerCase().trim();
  
  const matches = entities.filter((entity) => {
    const firstName = entity.split(' ')[0].toLowerCase();
    return firstName === inputLower;
  });
  
  if (matches.length === 1) {
    return {
      matched: matches[0],
      confidence: 0.9,
      matchType: 'fuzzy',
    };
  } else if (matches.length > 1) {
    return {
      matched: null,
      confidence: 0,
      matchType: 'none',
      candidates: matches.map((m) => ({ entity: m, score: 0.9 })),
    };
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}

/**
 * Match by last name only
 * Input: "smith" → Matches: "John Smith", "Sarah Smith"
 */
export function matchLastName(
  input: string,
  entities: string[]
): MatchResult {
  const inputLower = input.toLowerCase().trim();
  
  const matches = entities.filter((entity) => {
    const parts = entity.split(' ');
    const lastName = parts[parts.length - 1].toLowerCase();
    return lastName === inputLower;
  });
  
  if (matches.length === 1) {
    return {
      matched: matches[0],
      confidence: 0.85,
      matchType: 'fuzzy',
    };
  } else if (matches.length > 1) {
    return {
      matched: null,
      confidence: 0,
      matchType: 'none',
      candidates: matches.map((m) => ({ entity: m, score: 0.85 })),
    };
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}
