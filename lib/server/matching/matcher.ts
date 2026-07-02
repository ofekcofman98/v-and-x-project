import { ExactMatcher } from './exact-match';
import { PhoneticMatcher } from './phonetic-match';
import { FuzzyMatcher } from './fuzzy-match';
import { MatcherChain } from './MatcherChain';
import { getCachedMatch, setCachedMatch } from './cache';
import type { MatchConfig, MatchResult } from './types';

/**
 * Create a default matcher chain with standard configuration
 * Level 4 (LLM Semantic Match) is already implemented server-side and not included here
 */
export function createDefaultMatcherChain(config: MatchConfig = {}): MatcherChain {
  const {
    usePhonetic = true,
    useFuzzy = true,
    fuzzyThreshold = 2,
  } = config;

  const chain = new MatcherChain();
  
  chain.addMatcher(new ExactMatcher());
  
  if (usePhonetic) {
    chain.addMatcher(new PhoneticMatcher());
  }
  
  if (useFuzzy) {
    chain.addMatcher(new FuzzyMatcher(fuzzyThreshold));
  }
  
  return chain;
}

/**
 * Unified matching function with cascading strategy (Levels 1-3 only, client-side)
 * Uses Chain of Responsibility pattern for cleaner, more maintainable code
 */
export function match(
  input: string,
  entities: string[],
  config: MatchConfig = {}
): MatchResult {
  const { useCache = true } = config;
  
  if (useCache) {
    const cached = getCachedMatch(input, entities);
    if (cached) {
      console.log(`[Matcher] 🚀 Cache Hit for input: "${input}"`);
      return cached;
    }
  }
  
  const chain = createDefaultMatcherChain(config);
  const result = chain.match(input, entities, 0.85);
  
  console.log(`[Matcher] 🎯 Level reached: ${result.matchType} with confidence ${result.confidence}`);
  
  if (useCache) {
    setCachedMatch(input, entities, result);
  }
  
  return result;
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
    const chain = new MatcherChain()
      .addMatcher(new ExactMatcher())
      .addMatcher(new FuzzyMatcher(2));
    
    return chain.match(input, entities);
  }
  
  return match(input, entities);
}
