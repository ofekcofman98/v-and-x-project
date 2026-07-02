// Core types
export type {
  MatchResult,
  MatchConfig,
  Matcher,
} from './types';

// Matcher classes (OOP approach)
export { ExactMatcher } from './exact-match';
export { PhoneticMatcher } from './phonetic-match';
export { FuzzyMatcher } from './fuzzy-match';

// Chain of Responsibility
export { MatcherChain } from './MatcherChain';

// Legacy functions (backward compatibility)
export { exactMatch } from './exact-match';
export { phoneticMatch, soundex } from './phonetic-match';
export {
  fuzzyMatch,
  fuzzyMatchOptimized,
  levenshteinDistance,
} from './fuzzy-match';

// Partial matching
export { matchFirstName, matchLastName } from './partial-match';

// Ambiguity detection
export {
  detectAmbiguity,
  type AmbiguityResult,
} from './ambiguity';

// Caching
export {
  getCachedMatch,
  setCachedMatch,
} from './cache';

// Main matcher API
export {
  match,
  matchWithCache,
  matchWithEarlyTermination,
  createDefaultMatcherChain,
} from './matcher';
