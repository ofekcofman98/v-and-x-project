import { z } from 'zod';
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

/**
 * Navigation mode for Smart Pointer advancement — single source of truth.
 * Based on: docs/06_SMART_POINTER.md §3.1, docs/features/18_entity_first_navigation.md §5
 */
export type NavigationMode = 'column-first' | 'row-first' | 'entity-first';

/**
 * Zod schema mirroring NavigationMode, shared by every API route that
 * validates a request-supplied navigation mode (/api/parse, /api/voice-entry)
 * so the literal list is declared exactly once.
 */
export const NavigationModeSchema = z.enum(['column-first', 'row-first', 'entity-first']);

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
  navigationMode: NavigationMode;
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
