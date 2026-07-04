import type { TableSchema } from '@/lib/shared/types/table-schema';

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

/** Identifies which optimisation tier handled a voice entry request. */
export type ProcessingPath =
  | 'TRANSCRIPT_CACHE_HIT'
  | 'ENTITY_CACHE_HIT'
  | 'FAST_PATH'
  | 'LLM_FALLBACK';

/** Input metadata consumed by the voice entry service (excludes the raw audio file). */
export interface VoiceEntryPayload {
  tableSchema: TableSchema;
  activeCell: { rowKey: string; tableColumnId: string };
  navigationMode: 'column-first' | 'row-first';
  tableId: string;
  language?: string;
}

/** Full processing result returned by the service and serialised in the API response. */
export interface VoiceEntryResult extends ParsedResult {
  transcript: string;
  transcriptionDuration: number;
  parsingDuration: number;
  totalDuration: number;
  cached?: boolean;
  matchType?: MatchType;
  pathTaken?: ProcessingPath;
}

/** Standard API response envelope for the voice entry endpoint. */
export interface VoiceEntryResponse {
  success: boolean;
  data?: VoiceEntryResult;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
