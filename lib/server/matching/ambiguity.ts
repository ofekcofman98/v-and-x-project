import { MatchResult } from './types';
import { detectAmbiguity as detectAmbiguityShared, AmbiguityResult } from '@/lib/shared/utils/ambiguity';

export type { AmbiguityResult };

export function detectAmbiguity(
  matchResult: MatchResult,
  threshold: number = 0.85
): AmbiguityResult {
  const candidates = (matchResult.candidates ?? []).map((c) => ({
    entity: c.entity,
    confidence: c.score,
  }));

  return detectAmbiguityShared(matchResult.matched, matchResult.confidence, candidates, threshold);
}
