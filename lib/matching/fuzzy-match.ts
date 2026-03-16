import { distance } from 'fastest-levenshtein';
import type { MatchResult } from './exact-match';

/**
 * Calculate Levenshtein distance between two strings
 * (minimum number of edits to transform one string into another)
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Fuzzy matching using Levenshtein distance
 */
export function fuzzyMatch(
  input: string,
  entities: string[],
  threshold: number = 2
): MatchResult {
  const normalized = input.toLowerCase().trim();
  
  let bestMatch: string | null = null;
  let bestDistance = Infinity;
  
  for (const entity of entities) {
    const entityNorm = entity.toLowerCase().trim();
    const dist = levenshteinDistance(normalized, entityNorm);
    
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = entity;
    }
  }
  
  if (bestMatch && bestDistance <= threshold) {
    const confidence = 1.0 - (bestDistance * 0.05);
    
    return {
      matched: bestMatch,
      confidence,
      matchType: 'fuzzy',
    };
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}

/**
 * Optimized fuzzy matching using fastest-levenshtein
 */
export function fuzzyMatchOptimized(
  input: string,
  entities: string[],
  threshold: number = 2
): MatchResult {
  const normalized = input.toLowerCase().trim();
  
  const candidates = entities
    .map((entity) => ({
      entity,
      distance: distance(normalized, entity.toLowerCase().trim()),
    }))
    .filter((c) => c.distance <= threshold)
    .sort((a, b) => a.distance - b.distance);
  
  if (candidates.length > 0) {
    const best = candidates[0];
    const confidence = 1.0 - (best.distance * 0.05);
    
    return {
      matched: best.entity,
      confidence,
      matchType: 'fuzzy',
      candidates: candidates.slice(1, 4).map((c) => ({
        entity: c.entity,
        score: 1.0 - (c.distance * 0.05),
      })),
    };
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}
