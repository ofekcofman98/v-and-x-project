import { MatchResult } from "./types";

export interface AmbiguityResult {
  isAmbiguous: boolean;
  candidates: Array<{
    entity: string;
    confidence: number;
  }>;
  recommendedAction: 'auto_select' | 'ask_user' | 'create_new';
}

export function detectAmbiguity(
  matchResult: MatchResult,
  threshold: number = 0.85
): AmbiguityResult {
  if (matchResult.matched && matchResult.confidence >= threshold) {
    return {
      isAmbiguous: false,
      candidates: [{ entity: matchResult.matched, confidence: matchResult.confidence }],
      recommendedAction: 'auto_select',
    };
  }
  
  if (matchResult.candidates && matchResult.candidates.length > 1) {
    const topScore = matchResult.candidates[0].score;
    const similarCandidates = matchResult.candidates.filter(
      (c) => topScore - c.score < 0.1
    );
    
    if (similarCandidates.length > 1) {
      return {
        isAmbiguous: true,
        candidates: similarCandidates.map(c => ({ entity: c.entity, confidence: c.score })),
        recommendedAction: 'ask_user',
      };
    }
  }
  
  if (matchResult.matched && matchResult.confidence < 0.7) {
    return {
      isAmbiguous: true,
      candidates: matchResult.candidates?.map(c => ({ entity: c.entity, confidence: c.score })) || [],
      recommendedAction: 'create_new',
    };
  }
  
  if (!matchResult.matched) {
    return {
      isAmbiguous: false,
      candidates: [],
      recommendedAction: 'create_new',
    };
  }
  
  return {
    isAmbiguous: true,
    candidates: matchResult.candidates?.map(c => ({ entity: c.entity, confidence: c.score })) || [],
    recommendedAction: 'ask_user',
  };
}
