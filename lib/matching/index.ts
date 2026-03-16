export { exactMatch, type MatchResult } from './exact-match';
export { phoneticMatch, soundex } from './phonetic-match';
export {
  fuzzyMatch,
  fuzzyMatchOptimized,
  levenshteinDistance,
} from './fuzzy-match';
export { matchFirstName, matchLastName } from './partial-match';
export {
  detectAmbiguity,
  type AmbiguityResult,
} from './ambiguity';
export {
  getCachedMatch,
  setCachedMatch,
} from './cache';
export {
  match,
  matchWithCache,
  matchWithEarlyTermination,
  type MatchConfig,
} from './matcher';
