// lib/matching/types.ts ✅
export interface MatchResult {
    matched: string | null;
    confidence: number;
    matchType: 'exact' | 'phonetic' | 'fuzzy' | 'semantic' | 'none';
    candidates?: Array<{ entity: string; score: number }>;
  }
  
  export interface MatchConfig {
    usePhonetic?: boolean;
    useFuzzy?: boolean;
    fuzzyThreshold?: number;
    useCache?: boolean;
  }
  
  // Could also add the Matcher interface here if refactoring to OOP:
  export interface Matcher {
    match(input: string, entities: string[]): MatchResult;
    readonly name: string;
  }

  // Additive only — mirrors Matcher but returns a Promise, so it can wrap
  // async-only steps (e.g. VectorMatcher's embedding call) without changing
  // the sync Matcher contract or any existing matcher class.
  // docs/features/10_voice-pipeline-hardening.md §3.5
  export interface AsyncMatcher {
    match(input: string, entities: string[]): Promise<MatchResult>;
    readonly name: string;
  }
