import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { ServerTelemetrySpans } from '@/lib/shared/types/voice-telemetry';

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
  /** docs/features/19_voice_telemetry.md §3 Constraint 1 — threaded from client capture start. */
  requestId?: string;
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
  /** docs/features/19_voice_telemetry.md §6 — server-side spans for the client to merge. */
  telemetry?: ServerTelemetrySpans;
}

/** Standard API response envelope for the voice entry endpoint. */
export interface VoiceEntryResponse {
  success: boolean;
  data?: VoiceEntryResult | VoiceBatchResult;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** docs/features/19_voice_telemetry.md §7 — echoed back unchanged for correlation. */
  requestId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Entity Batch Voice Entry
// docs/features/03_ai_table_agent.md §5
// ─────────────────────────────────────────────────────────────────────────────

/** How a single batch entry was routed after resolution. */
export type BatchConfidenceRoute = 'auto' | 'disambiguate' | 'unresolved' | 'parse_error';

/** One resolved (or unresolved) cell write produced by the batch pipeline. */
export interface BatchCellWrite {
  rowKey: string | null;
  tableColumnId: string;
  value: unknown;
  valueValid: boolean;
  rawValueText: string;
  entity: string | null;
  entityMatch: EntityMatch | null;
  confidenceRoute: BatchConfidenceRoute;
  candidates?: Array<{ entity: string; rowKey: string; confidence: number }>;
}

/** Identifies which segmentation tier handled a batch voice entry request. */
export type BatchProcessingPath = 'BATCH_LOCAL_SEGMENTATION' | 'BATCH_LLM_SEGMENTATION';

/** Full processing result for a detected multi-entity batch utterance. */
export interface VoiceBatchResult {
  isBatch: true;
  writes: BatchCellWrite[];
  overflowCount: number;
  transcript: string;
  transcriptionDuration: number;
  parsingDuration: number;
  totalDuration: number;
  pathTaken: BatchProcessingPath;
  /** docs/features/19_voice_telemetry.md §6 — server-side spans for the client to merge. */
  telemetry?: ServerTelemetrySpans;
}

/** Type guard distinguishing a batch result from a single-entry ParsedResult/VoiceEntryResult. */
export function isVoiceBatchResult(
  result: ParsedResult | VoiceBatchResult
): result is VoiceBatchResult {
  return (result as VoiceBatchResult).isBatch === true;
}
