import { exactMatch, type MatchResult } from './exact-match';
import { phoneticMatch } from './phonetic-match';
import { fuzzyMatchOptimized } from './fuzzy-match';
import { getCachedMatch, setCachedMatch } from './cache';

export interface MatchConfig {
  usePhonetic?: boolean;
  useFuzzy?: boolean;
  fuzzyThreshold?: number;
  useCache?: boolean;
}

/**
 * Unified matching function with cascading strategy (Levels 1-3 only, client-side)
 * Level 4 (LLM Semantic Match) is already implemented server-side and not included here
 */
export function match(
  input: string,
  entities: string[],
  config: MatchConfig = {}
): MatchResult {
  const {
    usePhonetic = true,
    useFuzzy = true,
    fuzzyThreshold = 2,
    useCache = true,
  } = config;
  
  if (useCache) {
    const cached = getCachedMatch(input, entities);
    if (cached) {
      return cached;
    }
  }
  
  const exactResult = exactMatch(input, entities);
  if (exactResult.matched) {
    if (useCache) {
      setCachedMatch(input, entities, exactResult);
    }
    return exactResult;
  }
  
  if (usePhonetic) {
    const phoneticResult = phoneticMatch(input, entities);
    if (phoneticResult.matched) {
      if (useCache) {
        setCachedMatch(input, entities, phoneticResult);
      }
      return phoneticResult;
    }
  }
  
  if (useFuzzy) {
    const fuzzyResult = fuzzyMatchOptimized(input, entities, fuzzyThreshold);
    if (fuzzyResult.matched && fuzzyResult.confidence >= 0.85) {
      if (useCache) {
        setCachedMatch(input, entities, fuzzyResult);
      }
      return fuzzyResult;
    }
  }
  
  const noMatchResult: MatchResult = {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
  
  if (useCache) {
    setCachedMatch(input, entities, noMatchResult);
  }
  
  return noMatchResult;
}

/**
 * Match with cache support
 */
export function matchWithCache(
  input: string,
  entities: string[]
): MatchResult {
  return match(input, entities, { useCache: true });
}

/**
 * Skip expensive matching steps if entity count is small
 */
export function matchWithEarlyTermination(
  input: string,
  entities: string[]
): MatchResult {
  if (entities.length <= 5) {
    const exact = exactMatch(input, entities);
    if (exact.matched) return exact;
    
    const fuzzy = fuzzyMatchOptimized(input, entities);
    if (fuzzy.matched) return fuzzy;
    
    return {
      matched: null,
      confidence: 0,
      matchType: 'none',
    };
  }
  
  return match(input, entities);
}
