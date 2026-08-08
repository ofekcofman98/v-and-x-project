/**
 * Relocated to lib/shared/matching/phonetic-match.ts — dependency-free and
 * isomorphic. Re-exported here so existing relative imports within
 * lib/server/matching/ are unchanged. docs/features/15_realtime_voice_feedback.md §3.3
 */
export { PhoneticMatcher, phoneticMatch, soundex } from '@/lib/shared/matching/phonetic-match';
