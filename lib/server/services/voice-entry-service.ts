/**
 * Voice Entry Service
 * Implements the complete voice entry processing pipeline.
 *
 * Extracted from: app/api/voice-entry/route.ts
 * Based on: docs/05_VOICE_PIPELINE.md, docs/10_PERFORMANCE.md
 *
 * Pipeline stages:
 *   1. Transcript cache check → Whisper transcription
 *   2. Hallucination guard
 *   3. Entity recognition cache check
 *   4. Fast-path (regex extraction + non-LLM matching, Levels 1–3)
 *   5. LLM fallback (GPT-4o-mini, Level 4)
 *
 * Error contract:
 *   All known failure modes throw VocalGridError so the HTTP layer can map
 *   error codes to status codes without embedding business logic.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { ParsedResult, MatchType, ProcessingPath, VoiceEntryPayload, VoiceEntryResult } from '@/lib/shared/types/voice-pipeline';
import { parseForColumn, type ParseContext } from '@/lib/server/parsers/registry';
import { matchAsync } from '@/lib/server/matching/matcher';
import { transcriptCache } from '@/lib/server/cache/transcript-cache';
import { entityCache } from '@/lib/server/cache/entity-recognition-cache';
import { ErrorCodes, ErrorSeverity, ErrorCategory, VocalGridError } from '@/lib/shared/types/voice-errors';
import { buildWhisperPrompt as buildContextPrompt } from '@/lib/server/stt/context-prompt';

// Default ON — set ENABLE_STT_CONTEXT_PROMPT=false to disable vocabulary
// injection (e.g. to A/B the exact-match rate per docs/features/10 §2.3).
const STT_CONTEXT_PROMPT_ENABLED = process.env.ENABLE_STT_CONTEXT_PROMPT !== 'false';

// ProcessingPath, VoiceEntryPayload, and VoiceEntryResult are defined in
// @/lib/shared/types/voice-pipeline and re-exported below for convenience.
export type { ProcessingPath, VoiceEntryPayload, VoiceEntryResult } from '@/lib/shared/types/voice-pipeline';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singletons
// ─────────────────────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for LLM output validation
// ─────────────────────────────────────────────────────────────────────────────

const ParsedResultSchema = z.object({
  entity: z.string().nullable(),
  entityMatch: z
    .object({
      original: z.string().nullable(),
      matched: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      matchType: z.enum(['exact', 'fuzzy', 'phonetic', 'semantic']).nullable(),
    })
    .nullable(),
  value: z.unknown(),
  valueValid: z.boolean(),
  action: z.enum(['UPDATE_CELL', 'ERROR', 'AMBIGUOUS']),
  error: z.string().optional(),
  alternatives: z
    .array(
      z.object({
        entity: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .optional(),
  reasoning: z.string().optional(),
  duration: z.number().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Performance budget (docs/10_PERFORMANCE.md)
// ─────────────────────────────────────────────────────────────────────────────

const PERFORMANCE_BUDGET = {
  /** Optimal (no LLM) P50 target in ms */
  totalE2EOptimal: 1800,
  /** Total pipeline P95 budget in ms */
  totalE2E: 3500,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Main service function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the full voice entry pipeline and returns a structured result.
 *
 * Throws VocalGridError for all known failure modes; the route layer maps
 * those error codes to HTTP status codes.
 *
 * @param payload  - Parsed request metadata (schema, cell, navigation mode…)
 * @param audioFile - Already-validated audio File (not null, ≤ 25 MB)
 */
export async function processVoiceEntry(
  payload: VoiceEntryPayload,
  audioFile: File
): Promise<VoiceEntryResult> {
  const totalStartTime = Date.now();
  const { tableSchema, activeCell, navigationMode, tableId, language } = payload;

  // ── Stage 1: Transcription ─────────────────────────────────────────────────
  const transcriptionStartTime = Date.now();
  const { transcript, transcriptionDuration, audioDurationSec, promptEntities } = await transcribeAudio(
    audioFile,
    tableSchema,
    language,
    tableId,
    transcriptionStartTime
  );

  // ── Stage 2: Hallucination guard ──────────────────────────────────────────
  if (isWhisperHallucination(transcript, { audioDurationSec, promptEntities })) {
    console.log('[VoiceEntryService] Detected Whisper hallucination, skipping GPT call:', transcript);
    return {
      entity: null,
      entityMatch: null,
      value: null,
      valueValid: false,
      action: 'ERROR',
      error: 'Empty or invalid audio detected',
      transcript,
      transcriptionDuration,
      parsingDuration: 0,
      totalDuration: Date.now() - totalStartTime,
      pathTaken: 'LLM_FALLBACK',
    };
  }

  // ── Stage 3: Resolve active column / row ──────────────────────────────────
  const parsingStartTime = Date.now();
  const activeColumn = tableSchema.columns.find((col) => col.id === activeCell.tableColumnId);
  const activeRow = tableSchema.rows.find((row) => row.id === activeCell.rowKey);

  if (!activeColumn || !activeRow) {
    throw new VocalGridError(
      ErrorCodes.NO_CELL_SELECTED,
      'Active cell cannot be resolved.',
      {
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.VALIDATION,
        isRecoverable: true,
        userMessage: 'Active cell cannot be resolved.',
        context: { activeCell },
      }
    );
  }

  const entities = tableSchema.rows.map((r) => r.label);

  // ── Optimisation 1: Entity recognition cache ──────────────────────────────
  const cachedEntity = entityCache.get(transcript, tableId);

  if (cachedEntity) {
    console.log('[VoiceEntryService] 🚀 ENTITY_CACHE_HIT: Saved ~1500ms LLM call');
    const parsingDuration = Date.now() - parsingStartTime;
    const totalDuration = Date.now() - totalStartTime;

    const parseCtx = toParseContext(language);
    const parsed = parseForColumn(cachedEntity.value, activeColumn, parseCtx);

    const result: VoiceEntryResult = {
      entity: cachedEntity.entity,
      entityMatch: {
        original: cachedEntity.entity,
        matched: cachedEntity.entity,
        confidence: cachedEntity.confidence,
        matchType: cachedEntity.matchType,
      },
      value: parsed.value,
      valueValid: parsed.valid,
      action: 'UPDATE_CELL',
      reasoning: 'Cached result (saved ~1500ms LLM call)',
      duration: totalDuration,
      transcript,
      transcriptionDuration,
      parsingDuration,
      totalDuration,
      cached: true,
      matchType: cachedEntity.matchType,
      pathTaken: 'ENTITY_CACHE_HIT',
    };

    logPerformanceStats({
      transcript,
      transcriptionDuration,
      parsingDuration,
      totalDuration,
      matchType: cachedEntity.matchType,
      cached: true,
      pathTaken: 'ENTITY_CACHE_HIT',
    });

    return result;
  }

  // ── Optimisation 2: Fast path (regex + non-LLM matching, Levels 1–3) ──────
  const quickExtract = extractEntityQuick(transcript);

  if (quickExtract) {
    console.log('[VoiceEntryService] Quick extraction found pattern:', quickExtract);

    const matchResult = await matchAsync(quickExtract.entity, entities, tableId, {
      useCache: true,
      usePhonetic: true,
      useFuzzy: true,
      fuzzyThreshold: 4,
    });

    if (
      matchResult.matched !== null &&
      matchResult.confidence >= 0.85 &&
      matchResult.matchType !== 'none'
    ) {
      console.log('[VoiceEntryService] 🎯 FAST_PATH: Non-LLM match successful');
      const parsingDuration = Date.now() - parsingStartTime;
      const totalDuration = Date.now() - totalStartTime;

      const parsed = parseForColumn(quickExtract.value, activeColumn, toParseContext(language));

      // matchType is narrowed to MatchType by the !== 'none' guard above
      const safeMatchType: MatchType = matchResult.matchType;

      entityCache.set(transcript, tableId, {
        transcript,
        entity: matchResult.matched,
        value: quickExtract.value,
        confidence: matchResult.confidence,
        matchType: safeMatchType,
      });

      const result: VoiceEntryResult = {
        entity: matchResult.matched,
        entityMatch: {
          original: quickExtract.entity,
          matched: matchResult.matched,
          confidence: matchResult.confidence,
          matchType: safeMatchType,
        },
        value: parsed.value,
        valueValid: parsed.valid,
        action: 'UPDATE_CELL',
        reasoning: `Fast path: ${safeMatchType} match`,
        duration: totalDuration,
        transcript,
        transcriptionDuration,
        parsingDuration,
        totalDuration,
        cached: false,
        matchType: safeMatchType,
        pathTaken: 'FAST_PATH',
      };

      logPerformanceStats({
        transcript,
        transcriptionDuration,
        parsingDuration,
        totalDuration,
        matchType: safeMatchType,
        cached: false,
        pathTaken: 'FAST_PATH',
      });

      return result;
    }
  }

  // ── Optimisation 3: LLM fallback (GPT-4o-mini, Level 4) ──────────────────
  console.warn('[VoiceEntryService] ⚠️ LLM_FALLBACK: Fast path failed, falling back to GPT');
  const llmStartTime = Date.now();

  const prompt = buildParsePrompt({ transcript, tableSchema, activeCell, navigationMode });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a data entry assistant that extracts entities and values from voice transcripts.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 256,
  });

  const llmDuration = Date.now() - llmStartTime;
  const parsingDuration = Date.now() - parsingStartTime;
  const rawContent = completion.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('LLM returned empty content');
  }

  const parsedResult = parseCompletion(rawContent);

  const finalMatch = await matchAsync(parsedResult.entity ?? '', entities, tableId, {
    useCache: true,
    usePhonetic: true,
    useFuzzy: true,
    fuzzyThreshold: 4,
  });

  // `finalMatch` is the real matcher chain's verdict (Exact/Phonetic/Fuzzy/
  // Vector) against the actual row labels — it's the only source of truth
  // for whether `parsedResult.entity` (the LLM's raw transcript extraction,
  // e.g. "1.74" from a mis-heard "John 74") corresponds to a real row.
  // `parsedResult.entityMatch` is NOT a real match result: the parse prompt
  // explicitly tells the LLM not to attempt matching, and the JSON schema
  // it echoes back always carries the example's confidence: 1.0. Falling
  // back to either of those on a matcher miss would report a fabricated
  // high-confidence match for an entity that doesn't exist in the schema.
  const matchedEntity = finalMatch.matched;
  const parsed = parseForColumn(parsedResult.value, activeColumn, toParseContext(language));
  const totalDuration = Date.now() - totalStartTime;

  const responsePayload: VoiceEntryResult = {
    ...parsedResult,
    entity: matchedEntity,
    entityMatch: {
      original: parsedResult.entity,
      matched: matchedEntity,
      confidence: finalMatch.confidence,
      matchType: matchedEntity ? 'semantic' : null,
    },
    value: parsed.value,
    valueValid: parsed.valid,
    // No real match against the schema — ask the user instead of silently
    // committing (or crashing downstream on) an unresolved entity.
    action: matchedEntity ? parsedResult.action : 'AMBIGUOUS',
    duration: totalDuration,
    error: parsed.valid ? parsedResult.error : (parsed.error ?? parsedResult.error),
    transcript,
    transcriptionDuration,
    parsingDuration,
    totalDuration,
    cached: false,
    matchType: matchedEntity ? 'semantic' : undefined,
    pathTaken: 'LLM_FALLBACK',
  };

  if (
    matchedEntity !== null &&
    responsePayload.entityMatch !== null &&
    responsePayload.entityMatch.confidence >= 0.7
  ) {
    entityCache.set(transcript, tableId, {
      transcript,
      entity: matchedEntity,
      value: parsedResult.value,
      confidence: responsePayload.entityMatch.confidence,
      matchType: 'semantic',
    });
  }

  logPerformanceStats({
    transcript,
    transcriptionDuration,
    parsingDuration,
    totalDuration,
    matchType: 'semantic',
    cached: false,
    pathTaken: 'LLM_FALLBACK',
    llmDuration,
  });

  console.log('[VoiceEntryService] Complete:', {
    transcript,
    transcriptionDuration,
    parsingDuration,
    llmDuration,
    totalDuration,
    result: responsePayload,
  });

  return responsePayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private – transcription
// ─────────────────────────────────────────────────────────────────────────────

interface TranscriptionResult {
  transcript: string;
  transcriptionDuration: number;
  /** True when the result was served from the transcript cache. */
  transcriptFromCache: boolean;
  /** Audio duration in seconds, when known (verbose_json only). */
  audioDurationSec?: number;
  /** Vocabulary entities injected into the Whisper prompt, for the hallucination guard. */
  promptEntities: string[];
}

async function transcribeAudio(
  audioFile: File,
  tableSchema: TableSchema,
  language: string | undefined,
  tableId: string,
  startTime: number
): Promise<TranscriptionResult> {
  const cached = await transcriptCache.get(audioFile);

  if (cached) {
    console.log('[VoiceEntryService] 🚀 TRANSCRIPT_CACHE_HIT: Saved 1300ms transcription');
    return { transcript: cached.text, transcriptionDuration: 0, transcriptFromCache: true, promptEntities: [] };
  }

  try {
    const whisperPrompt = buildWhisperPrompt(tableSchema, tableId);
    const promptUsed = STT_CONTEXT_PROMPT_ENABLED && whisperPrompt.length > 0;

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language as 'en' | 'he' | undefined,
      response_format: 'verbose_json',
      // temperature: 0 is required whenever a prompt is supplied — reduces
      // hallucination amplification (docs/features/10 §2.3).
      temperature: 0,
      ...(promptUsed ? { prompt: whisperPrompt } : {}),
    });

    const transcriptionDuration = Date.now() - startTime;
    const transcript = extractTranscriptFromSegments(transcription);
    const audioDurationSec = typeof transcription.duration === 'number' ? transcription.duration : undefined;

    await transcriptCache.set(audioFile, transcript, transcriptionDuration);
    console.log('[VoiceEntryService] Transcription complete and cached:', {
      transcript,
      duration: transcriptionDuration,
      promptUsed,
    });

    return {
      transcript,
      transcriptionDuration,
      transcriptFromCache: false,
      audioDurationSec,
      promptEntities: promptUsed ? tableSchema.rows.map((r) => r.label) : [],
    };
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };

    if (err?.status === 429) {
      throw new VocalGridError(
        ErrorCodes.STT_RATE_LIMIT,
        'Whisper API rate limit reached.',
        {
          severity: ErrorSeverity.WARNING,
          category: ErrorCategory.EXTERNAL_API,
          isRecoverable: true,
          userMessage: 'Too many requests. Please wait a moment and try again.',
          context: { originalError: err },
        }
      );
    }

    if (err?.status === 400) {
      throw new VocalGridError(
        ErrorCodes.STT_INVALID_AUDIO,
        'Whisper rejected the audio file.',
        {
          severity: ErrorSeverity.WARNING,
          category: ErrorCategory.EXTERNAL_API,
          isRecoverable: true,
          userMessage: 'Invalid audio format. Please try recording again.',
          context: { originalError: err },
        }
      );
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private – prompt builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a token-budgeted Whisper vocabulary prompt from the table's entity
 * labels, prioritizing recently-matched entities for this table.
 * docs/features/10_voice-pipeline-hardening.md §2.1–2.2
 */
function buildWhisperPrompt(tableSchema: TableSchema, tableId: string): string {
  if (!STT_CONTEXT_PROMPT_ENABLED) return '';

  const entities = tableSchema.rows.map((r) => r.label);
  const recentEntities = entityCache.getRecentEntities(tableId);

  return buildContextPrompt(entities, { recentEntities });
}

interface WhisperSegment {
  text: string;
  no_speech_prob?: number;
  avg_logprob?: number;
}

/**
 * Discards low-confidence segments (silence/noise echoes) before joining
 * the transcript. docs/features/10_voice-pipeline-hardening.md §2.3
 */
function extractTranscriptFromSegments(transcription: { text: string; segments?: WhisperSegment[] }): string {
  const segments = transcription.segments;
  if (!segments || segments.length === 0) return transcription.text;

  const kept = segments.filter(
    (seg) => (seg.no_speech_prob ?? 0) <= 0.6 && (seg.avg_logprob ?? 0) >= -1.0
  );

  if (kept.length === 0) return '';

  return kept.map((seg) => seg.text).join(' ').trim();
}

function buildParsePrompt(params: {
  transcript: string;
  tableSchema: TableSchema;
  activeCell: { rowKey: string; tableColumnId: string };
  navigationMode: 'column-first' | 'row-first';
}): string {
  const { transcript, tableSchema, activeCell, navigationMode } = params;
  const currentColumn = tableSchema.columns.find((col) => col.id === activeCell.tableColumnId);
  const columnType = currentColumn?.type ?? ColumnType.TEXT;

  // Deliberately omit the rows/entities array to keep the context diet.
  // Entity matching is handled separately by the matcher chain.
  return `
You are a lightning-fast data extraction assistant.
Your ONLY job is to extract the spoken entity and the value from the transcript.
Do NOT attempt to match the entity against any database. Return EXACTLY what was heard.

CURRENT STATE:
- Navigation mode: ${navigationMode}
- Expected Column Type: ${columnType} (e.g. if 'number', convert word numbers like "eighty" to 80)

USER SAID: "${transcript}"

RESPOND ONLY IN JSON (strictly matching this schema):
{
  "entity": "The exact entity name you heard",
  "entityMatch": {
    "original": "The exact entity name you heard",
    "matched": "The exact entity name you heard",
    "confidence": 1.0,
    "matchType": "exact"
  },
  "value": "The extracted value",
  "valueValid": true,
  "action": "UPDATE_CELL",
  "reasoning": "Extracted raw data from transcript"
}
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Private – value normalisation & LLM output parsing
// ─────────────────────────────────────────────────────────────────────────────

function toParseContext(language: string | undefined): ParseContext {
  return { language: language === 'he' || language === 'en' ? language : 'auto' };
}

function parseCompletion(content: string): ParsedResult {
  const parsed: unknown = JSON.parse(content);
  const validated = ParsedResultSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error('LLM output did not match expected schema');
  }

  return validated.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private – fast-path regex extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts to extract entity + value via lightweight regex patterns before
 * falling back to the LLM.
 * docs/10_PERFORMANCE.md §4.5
 */
function extractEntityQuick(
  transcript: string
): { entity: string; value: number | string } | null {
  const PATTERNS: RegExp[] = [
    /^(.+?),\s*(\d+\.?\d*)$/,  // "Student A, 84"
    /^(.+?)\s+(\d+\.?\d*)$/,   // "Student A 84"
    /^(.+?),\s*([a-zA-Z]+)$/,  // "Student A, present"
    /^(.+?)\s+([a-zA-Z]+)$/,   // "Student A present"
  ];

  for (const pattern of PATTERNS) {
    const regexMatch = transcript.trim().match(pattern);
    if (regexMatch) {
      const entity = regexMatch[1].trim();
      const rawValue = regexMatch[2];
      const value: number | string = isNaN(Number(rawValue)) ? rawValue : Number(rawValue);
      return { entity, value };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private – hallucination detection
// ─────────────────────────────────────────────────────────────────────────────

const WHISPER_HALLUCINATIONS: ReadonlySet<string> = new Set([
  'thank you',
  'thank you.',
  'thank you for watching',
  'thank you for watching.',
  'thank you for your time',
  'thank you for your time.',
  'thanks for watching',
  'thanks for watching.',
  'bye',
  'bye.',
  'goodbye',
  'goodbye.',
  '...',
  '. . .',
  'music',
  '[music]',
  '(music)',
  'silence',
  '[silence]',
  '(silence)',
]);

/**
 * Returns true when the transcript is a well-known Whisper hallucination.
 * Exported for unit testing.
 * docs/05_VOICE_PIPELINE.md §2.3, docs/features/10_voice-pipeline-hardening.md §2.3
 */
export function isWhisperHallucination(
  transcript: string,
  opts?: { audioDurationSec?: number; promptEntities?: string[] }
): boolean {
  const normalized = transcript.trim().toLowerCase();

  if (normalized.length < 2) return true;
  if (WHISPER_HALLUCINATIONS.has(normalized)) return true;
  if (/^[.,!?;:\s]+$/.test(normalized)) return true;

  // Prompt-echo guard: a bare vocabulary entity with no value component on
  // a near-silent clip is almost always Whisper parroting the prompt back.
  const isBareEntityEcho = (opts?.promptEntities ?? []).some(
    (entity) => entity.trim().toLowerCase() === normalized
  );
  const isNearSilent = (opts?.audioDurationSec ?? Infinity) < 0.5;
  if (isBareEntityEcho && isNearSilent) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private – performance monitoring
// ─────────────────────────────────────────────────────────────────────────────

interface PerformanceMetrics {
  transcript: string;
  transcriptionDuration: number;
  parsingDuration: number;
  totalDuration: number;
  matchType: MatchType;
  cached: boolean;
  pathTaken: ProcessingPath;
  llmDuration?: number;
}

/**
 * Logs per-request performance metrics and emits periodic cache statistics.
 * docs/10_PERFORMANCE.md §8.3
 */
function logPerformanceStats(metrics: PerformanceMetrics): void {
  const {
    transcript,
    transcriptionDuration,
    parsingDuration,
    totalDuration,
    matchType,
    cached,
    pathTaken,
    llmDuration,
  } = metrics;

  const exceedsBudget = totalDuration > PERFORMANCE_BUDGET.totalE2E;
  const isOptimal = totalDuration <= PERFORMANCE_BUDGET.totalE2EOptimal;

  let recommendation = '';
  if (pathTaken === 'LLM_FALLBACK') {
    recommendation =
      '⚠️ LLM fallback used. Consider improving fuzzy matching or caching this entity.';
  } else if (isOptimal) {
    recommendation = '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.';
  }

  const logEntry = {
    transcript: transcript.substring(0, 50),
    pathTaken,
    matchType,
    cached,
    transcriptionDuration: `${transcriptionDuration}ms`,
    parsingDuration: `${parsingDuration}ms`,
    llmDuration: llmDuration !== undefined ? `${llmDuration}ms` : 'N/A',
    totalDuration: `${totalDuration}ms`,
    budget: `${PERFORMANCE_BUDGET.totalE2E}ms`,
    exceedsBudget,
    isOptimal,
    recommendation,
  };

  if (exceedsBudget) {
    console.warn('[Performance] ⚠️ BUDGET EXCEEDED:', logEntry);
  } else {
    console.log('[Performance] ✅', logEntry);
  }

  // Sample 10 % of requests for cache statistics to avoid log noise
  if (Math.random() < 0.1) {
    const stats = entityCache.getStats();
    console.log('[EntityCache] Statistics:', {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
      size: stats.size,
      estimatedTimeSaved: `${(stats.estimatedTimeSaved / 1000).toFixed(1)}s`,
    });
  }
}
