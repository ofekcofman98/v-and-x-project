export interface AmbiguityCandidate {
  entity: string;
  confidence: number;
}

export interface AmbiguityResult {
  isAmbiguous: boolean;
  candidates: AmbiguityCandidate[];
  recommendedAction: 'auto_select' | 'ask_user' | 'create_new';
}

/**
 * Pure ambiguity classifier over an already-computed match. Used both by the
 * server matcher (against its internal MatchResult) and client hooks (against
 * the entityMatch/alternatives already returned by /api/voice-entry) — no
 * matching/db logic here, just decision rules.
 */
export function detectAmbiguity(
  matched: string | null,
  confidence: number,
  candidates: AmbiguityCandidate[] = [],
  threshold: number = 0.85
): AmbiguityResult {
  if (matched && confidence >= threshold) {
    return {
      isAmbiguous: false,
      candidates: [{ entity: matched, confidence }],
      recommendedAction: 'auto_select',
    };
  }

  if (candidates.length > 1) {
    const topScore = candidates[0].confidence;
    const similarCandidates = candidates.filter((c) => topScore - c.confidence < 0.1);

    if (similarCandidates.length > 1) {
      return {
        isAmbiguous: true,
        candidates: similarCandidates,
        recommendedAction: 'ask_user',
      };
    }
  }

  if (matched && confidence < 0.7) {
    return {
      isAmbiguous: true,
      candidates,
      recommendedAction: 'create_new',
    };
  }

  if (!matched) {
    return {
      isAmbiguous: false,
      candidates: [],
      recommendedAction: 'create_new',
    };
  }

  return {
    isAmbiguous: true,
    candidates,
    recommendedAction: 'ask_user',
  };
}
