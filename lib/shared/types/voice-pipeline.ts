export type MatchType = 'exact' | 'fuzzy' | 'phonetic' | 'semantic';

export interface EntityMatch {
  original: string | null;
  matched: string | null;
  confidence: number;
  matchType: MatchType | null;
}

export type ParseAction = 'UPDATE_CELL' | 'ERROR' | 'AMBIGUOUS';

export interface ParsedResult {
  entity: string | null;
  entityMatch: EntityMatch | null;
  value: unknown;
  valueValid: boolean;
  action: ParseAction;
  error?: string;
  alternatives?: Array<{
    entity: string;
    confidence: number;
  }>;
  reasoning?: string;
  duration?: number;
}
