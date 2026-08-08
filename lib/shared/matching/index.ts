/**
 * Shared matcher primitives — Levels 1-3 (exact/phonetic/fuzzy) only.
 * Dependency-free, isomorphic; safe for both client and server.
 * Level 4 (VectorMatcher, ONNX) and caching remain server-only in
 * lib/server/matching/. docs/features/15_realtime_voice_feedback.md §3.3
 */
export type { MatchResult, MatchConfig, Matcher, AsyncMatcher } from './types';
export { ExactMatcher, exactMatch } from './exact-match';
export { PhoneticMatcher, phoneticMatch, soundex } from './phonetic-match';
export { FuzzyMatcher, fuzzyMatch, fuzzyMatchOptimized, levenshteinDistance } from './fuzzy-match';
export { MatcherChain } from './MatcherChain';
