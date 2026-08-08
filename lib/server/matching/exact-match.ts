/**
 * Relocated to lib/shared/matching/exact-match.ts — dependency-free and
 * isomorphic. Re-exported here so existing relative imports within
 * lib/server/matching/ are unchanged. docs/features/15_realtime_voice_feedback.md §3.3
 */
export { ExactMatcher, exactMatch } from '@/lib/shared/matching/exact-match';
