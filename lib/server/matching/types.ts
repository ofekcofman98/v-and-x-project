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
