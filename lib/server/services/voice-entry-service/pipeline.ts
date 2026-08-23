/**
 * Voice Entry Pipeline
 * Implements the complete voice entry processing pipeline.
 *
 * Extracted from: app/api/voice-entry/route.ts
 * Based on: docs/05_VOICE_PIPELINE.md, docs/10_PERFORMANCE.md
 *
 * Pipeline stages:
 *   1. Transcript cache check → Whisper transcription
 *   2. Hallucination guard (empty transcript or repetition-loop — fail fast)
 *   3. Resolve active column/row (+ 3.5: Row-first mid-row shortcut)
 *   4. Entity recognition cache check
 *   5. Fast-path (regex extraction + non-LLM matching, Levels 1–3)
 *   6. LLM fallback (GPT-4o-mini, Level 4)
 *
 * Error contract:
 *   All known failure modes throw VocalGridError so the HTTP layer can map
 *   error codes to status codes without embedding business logic.
 */

import type {
  MatchType,
  VoiceEntryPayload,
  VoiceEntryResult,
  VoiceBatchResult,
} from '@/lib/shared/types/voice-pipeline';
import type { MatchingTier, ServerTelemetrySpans } from '@/lib/shared/types/voice-telemetry';
import { parseForColumn } from '@/lib/server/parsers/registry';
import { matchAsync } from '@/lib/server/matching/matcher';
import { entityCache } from '@/lib/server/cache/entity-recognition-cache';
import { ErrorCodes, ErrorSeverity, ErrorCategory, VocalGridError } from '@/lib/shared/types/voice-errors';
import { openai } from './openai-client';
import { transcribeAudio } from './transcription';
import { isWhisperHallucination, isDegenerateRepetition } from './hallucination';
import { isRowFirstMidRow } from './row-first';
import { resolveBareValueEntry } from './bare-value';
import { extractEntityQuick } from './quick-extract';
import { toParseContext } from './parse-context';
import { buildParsePrompt, extractValueOnlyViaLLM, parseCompletion } from './llm-prompts';
import { logPerformanceStats } from './performance-logging';
import { looksLikeBatchUtterance } from './batch-detect';
import { processVoiceEntryBatch, BatchSegmentationFailedError } from './batch-orchestrator';
import { AI_MODELS, AI_TUNING } from '@/lib/server/services/ai-service/shared/config';
import { VOICE_ACCURACY_TELEMETRY_ENABLED } from '@/lib/server/services/telemetry/config';

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
): Promise<VoiceEntryResult | VoiceBatchResult> {
  const totalStartTime = Date.now();
  const { tableSchema, activeCell, navigationMode, tableId, language } = payload;

  // Row-First mid-row entries are deterministically value-only (no entity to
  // be spoken) — known from navigationMode + activeCell alone, before we even
  // transcribe. Used both to suppress the entity-vocabulary Whisper prompt
  // (Stage 1) and to skip entity resolution entirely (Stage 3.5).
  const isMidRowValueOnly = isRowFirstMidRow(navigationMode, activeCell, tableSchema);

  // ── Stage 1: Transcription ─────────────────────────────────────────────────
  // docs/features/19_voice_telemetry.md §6 — timed at this call site rather
  // than inside transcription.ts itself (transcribeAudio already returns
  // transcriptionDuration; only the wall-clock ISO boundaries are new here).
  const transcriptionStartTime = Date.now();
  const transcriptionStartAt = new Date(transcriptionStartTime).toISOString();
  const { transcript, transcriptionDuration, audioDurationSec, promptEntities } = await transcribeAudio(
    audioFile,
    tableSchema,
    language,
    tableId,
    transcriptionStartTime,
    { suppressVocabPrompt: isMidRowValueOnly }
  );
  const transcriptionEndAt = new Date().toISOString();

  // Mutable span state, filled in as later stages run; captured into a
  // ServerTelemetrySpans object at every return point via buildTelemetry().
  let llmParseStartAt: string | undefined;
  let llmParseEndAt: string | undefined;
  let matchingStartAt: string | undefined;
  let matchingEndAt: string | undefined;
  let matchingTierUsed: MatchingTier | undefined;

  /**
   * Assembles the telemetry spans object attached to every returned result.
   * `matchedEntityLabel`, when accuracy telemetry is enabled, is the row
   * label the pipeline resolved to (see §8: matched_entity_value).
   */
  function buildTelemetry(matchedEntityLabel?: string | null): ServerTelemetrySpans {
    const spans: ServerTelemetrySpans = {
      transcriptionStartAt,
      transcriptionEndAt,
      llmParseStartAt,
      llmParseEndAt,
      matchingStartAt,
      matchingEndAt,
      matchingTierUsed,
    };

    if (VOICE_ACCURACY_TELEMETRY_ENABLED) {
      spans.whisperTranscript = transcript;
      if (matchedEntityLabel) spans.matchedEntityValue = matchedEntityLabel;
    }

    return spans;
  }

  // ── Stage 2: Hallucination guard ──────────────────────────────────────────
  // Fail fast on unusable transcripts (empty or a repetition-loop) rather
  // than retrying — a retry pass doubles transcription latency (~1.5-4s)
  // without reliably salvaging genuinely clipped/ambient audio.
  // docs/06_SMART_POINTER_LOGS.md
  if (isWhisperHallucination(transcript, { audioDurationSec, promptEntities }) || isDegenerateRepetition(transcript)) {
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
      telemetry: buildTelemetry(),
    };
  }

  // ── Stage 2.5: Batch detection gate ───────────────────────────────────────
  // Must win over Stage 3.5's mid-row shortcut below: a batch of bare values
  // in row-first mode IS that shortcut's multi-value generalization. Cost
  // when false (the overwhelming majority) is one cheap regex scan — the
  // single-entry cache/fast-path/LLM-fallback stages below are untouched.
  // docs/features/03_ai_table_agent.md §5.5
  if (looksLikeBatchUtterance(transcript)) {
    try {
      const batchResult = await processVoiceEntryBatch(transcript, payload, {
        transcriptionDuration,
        totalStartTime,
      });
      return { ...batchResult, telemetry: buildTelemetry() };
    } catch (err) {
      if (!(err instanceof BatchSegmentationFailedError)) throw err;
      console.warn('[VoiceEntryService] Batch segmentation failed, degrading to single-entry:', transcript);
      // Falls through to the single-entry pipeline below.
    }
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

  // ── Stage 3.5: Row-first mid-row shortcut ─────────────────────────────────
  // Past the row's first editable column, Row-First deterministically knows
  // there is no entity to resolve — the pointer already identifies the row.
  // Skip entity cache, quick-extraction, and LLM entity matching entirely.
  // Unlike Optimisation 2.5 below (a content-based guess restricted to
  // non-TEXT columns), this applies to ALL column types, because navigation
  // state — not transcript content — is what tells us no entity is expected.
  if (isMidRowValueOnly) {
    const parseCtx = toParseContext(language);
    const directParse = parseForColumn(transcript.trim(), activeColumn, parseCtx);

    if (directParse.valid) {
      console.log('[VoiceEntryService] 🎯 FAST_PATH: Row-first mid-row value (no entity resolution)');
      const parsingDuration = Date.now() - parsingStartTime;
      const totalDuration = Date.now() - totalStartTime;
      // No matchAsync call here — the pointer already identifies the row.
      // matchingStartAt/EndAt stay null per §7; the tier is still known.
      matchingTierUsed = 'exact';

      const result: VoiceEntryResult = {
        entity: activeRow.label,
        entityMatch: {
          original: null,
          matched: activeRow.label,
          confidence: 1,
          matchType: 'exact',
        },
        value: directParse.value,
        valueValid: true,
        action: 'UPDATE_CELL',
        reasoning: 'Row-first mid-row value — entity already established by the pointer',
        duration: totalDuration,
        transcript,
        transcriptionDuration,
        parsingDuration,
        totalDuration,
        cached: false,
        matchType: 'exact',
        pathTaken: 'FAST_PATH',
        telemetry: buildTelemetry(activeRow.label),
      };

      logPerformanceStats({
        transcript,
        transcriptionDuration,
        parsingDuration,
        totalDuration,
        matchType: 'exact',
        cached: false,
        pathTaken: 'FAST_PATH',
      });

      return result;
    }

    // Direct parse failed (e.g. a spoken word-number needing LLM
    // normalization) — still skip straight to a value-only LLM call. No
    // matchAsync, no AMBIGUOUS possible here: the row is already known.
    const parsingDuration = Date.now() - parsingStartTime;
    const llmStartTime = Date.now();
    llmParseStartAt = new Date(llmStartTime).toISOString();
    const rawValue = await extractValueOnlyViaLLM(transcript, activeColumn);
    llmParseEndAt = new Date().toISOString();
    const llmDuration = Date.now() - llmStartTime;
    const valueParsed = parseForColumn(rawValue, activeColumn, parseCtx);
    const totalDuration = Date.now() - totalStartTime;
    // No matchAsync call here either — the pointer already identifies the row.
    matchingTierUsed = 'exact';

    const result: VoiceEntryResult = {
      entity: activeRow.label,
      entityMatch: {
        original: null,
        matched: activeRow.label,
        confidence: 1,
        matchType: 'exact',
      },
      value: valueParsed.value,
      valueValid: valueParsed.valid,
      action: valueParsed.valid ? 'UPDATE_CELL' : 'ERROR',
      error: valueParsed.valid ? undefined : valueParsed.error,
      reasoning: 'Row-first mid-row value via LLM normalization — entity already established by the pointer',
      duration: totalDuration,
      transcript,
      transcriptionDuration,
      parsingDuration,
      totalDuration,
      cached: false,
      matchType: 'exact',
      pathTaken: 'LLM_FALLBACK',
      telemetry: buildTelemetry(activeRow.label),
    };

    logPerformanceStats({
      transcript,
      transcriptionDuration,
      parsingDuration,
      totalDuration,
      matchType: 'exact',
      cached: false,
      pathTaken: 'LLM_FALLBACK',
      llmDuration,
    });

    return result;
  }

  // ── Optimisation 1: Entity recognition cache ──────────────────────────────
  const cachedEntity = entityCache.get(transcript, tableId);

  if (cachedEntity) {
    console.log('[VoiceEntryService] 🚀 ENTITY_CACHE_HIT: Saved ~1500ms LLM call');
    const parsingDuration = Date.now() - parsingStartTime;
    const totalDuration = Date.now() - totalStartTime;
    // Cache hit bypasses matchAsync entirely — spans stay null, tier is known.
    matchingTierUsed = cachedEntity.matchType;

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
      telemetry: buildTelemetry(cachedEntity.entity),
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
  // Tracks whether quickExtract's entity guess actually resolved to a real
  // row — if not, Optimisation 2.5 below still gets a shot at the transcript
  // as a bare value (e.g. "Not here" split into entity:"Not" value:"here"
  // must not block the bare-value path that would have parsed the whole
  // transcript correctly).
  let quickExtractMatchedRow = false;

  if (quickExtract) {
    console.log('[VoiceEntryService] Quick extraction found pattern:', quickExtract);

    const matchStartTime = Date.now();
    matchingStartAt = new Date(matchStartTime).toISOString();
    const matchResult = await matchAsync(quickExtract.entity, entities, tableId, {
      useCache: true,
      usePhonetic: true,
      useFuzzy: true,
      fuzzyThreshold: 4,
    });
    matchingEndAt = new Date().toISOString();

    if (
      matchResult.matched !== null &&
      matchResult.confidence >= 0.85 &&
      matchResult.matchType !== 'none'
    ) {
      quickExtractMatchedRow = true;
      console.log('[VoiceEntryService] 🎯 FAST_PATH: Non-LLM match successful');
      const parsingDuration = Date.now() - parsingStartTime;
      const totalDuration = Date.now() - totalStartTime;

      const parsed = parseForColumn(quickExtract.value, activeColumn, toParseContext(language));

      // matchType is narrowed to MatchType by the !== 'none' guard above
      const safeMatchType: MatchType = matchResult.matchType;
      matchingTierUsed = safeMatchType;

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
        telemetry: buildTelemetry(matchResult.matched),
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

  // ── Optimisation 2.5: Bare-value fast path ────────────────────────────────
  // activeCell already identifies the row (via click, or via Smart Pointer
  // row-first advance) — a lone value needs no entity restated. Reachable
  // when quickExtract's "Entity, value" pattern didn't match at all, OR when
  // it matched but the guessed "entity" didn't resolve to a real row (e.g.
  // "Not here" is split into entity:"Not" value:"here" — that guess is
  // wrong, but the full transcript is a valid bare boolean value).
  if (!quickExtract || !quickExtractMatchedRow) {
    const bareValue = resolveBareValueEntry(transcript, activeColumn, activeRow, toParseContext(language));

    if (bareValue) {
      console.log('[VoiceEntryService] 🎯 FAST_PATH: Bare value for already-selected cell');
      const parsingDuration = Date.now() - parsingStartTime;
      const totalDuration = Date.now() - totalStartTime;
      // No matchAsync call — the active cell already identifies the row.
      matchingTierUsed = 'exact';

      const result: VoiceEntryResult = {
        entity: bareValue.matched,
        entityMatch: {
          original: null,
          matched: bareValue.matched,
          confidence: 1,
          matchType: 'exact',
        },
        value: bareValue.value,
        valueValid: true,
        action: 'UPDATE_CELL',
        reasoning: 'Bare value for already-selected cell (no entity restated)',
        duration: totalDuration,
        transcript,
        transcriptionDuration,
        parsingDuration,
        totalDuration,
        cached: false,
        matchType: 'exact',
        pathTaken: 'FAST_PATH',
        telemetry: buildTelemetry(bareValue.matched),
      };

      logPerformanceStats({
        transcript,
        transcriptionDuration,
        parsingDuration,
        totalDuration,
        matchType: 'exact',
        cached: false,
        pathTaken: 'FAST_PATH',
      });

      return result;
    }
  }

  // ── Optimisation 3: LLM fallback (GPT-4o-mini, Level 4) ──────────────────
  console.warn('[VoiceEntryService] ⚠️ LLM_FALLBACK: Fast path failed, falling back to GPT');
  const llmStartTime = Date.now();
  llmParseStartAt = new Date(llmStartTime).toISOString();

  const prompt = buildParsePrompt({ transcript, tableSchema, activeCell, navigationMode });

  const completion = await openai.chat.completions.create({
    model: AI_MODELS.CHAT,
    messages: [
      {
        role: 'system',
        content:
          'You are a data entry assistant that extracts entities and values from voice transcripts.',
      },
      {
        role: 'user',
        content: prompt
      },
    ],
    response_format: { type: 'json_object' },
    temperature: AI_TUNING.JSON_TEMPERATURE,
    max_tokens: AI_TUNING.MAX_TOKENS.PARSE,
  });

  llmParseEndAt = new Date().toISOString();
  const llmDuration = Date.now() - llmStartTime;
  const parsingDuration = Date.now() - parsingStartTime;
  const rawContent = completion.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('LLM returned empty content');
  }

  const parsedResult = parseCompletion(rawContent);
  const parsed = parseForColumn(parsedResult.value, activeColumn, toParseContext(language));
  const totalDuration = Date.now() - totalStartTime;

  // GPT was explicitly instructed (buildParsePrompt) to report entity: null
  // when the transcript is a bare value with no name/entity mentioned at
  // all. In that case there is nothing to match against the schema — the
  // activeCell (click, or Smart Pointer row-first advance) already tells us
  // which row this is. Only when GPT reports an actual spoken entity do we
  // run it through the matcher chain and risk AMBIGUOUS.
  const noEntitySpoken = !parsedResult.entity || parsedResult.entity.trim().length === 0;

  // A transcript that hallucination-guard filters didn't anticipate (e.g. an
  // unrecognized stock phrase) can reach here with GPT correctly reporting
  // no entity AND no usable value. Attributing that to the active row would
  // silently overwrite it — parsed.valid (a non-null, ColumnType-checked
  // value) is required before the "no entity spoken" shortcut applies.
  if (noEntitySpoken && !parsed.valid) {
    console.warn(
      '[VoiceEntryService] LLM fallback returned no entity and no usable value — refusing to attribute to the active row:',
      { transcript, rawValue: parsedResult.value }
    );

    return {
      entity: null,
      entityMatch: null,
      value: null,
      valueValid: false,
      action: 'ERROR',
      error: parsed.error ?? 'Could not extract a usable entity or value from the transcript',
      transcript,
      transcriptionDuration,
      parsingDuration,
      totalDuration,
      cached: false,
      pathTaken: 'LLM_FALLBACK',
      telemetry: buildTelemetry(),
    };
  }

  let matchedEntity: string | null;
  let matchConfidence: number;
  let matchType: MatchType | null;

  if (noEntitySpoken) {
    matchedEntity = activeRow.label;
    matchConfidence = 1;
    matchType = 'exact';
    matchingTierUsed = 'exact'; // No matchAsync call — the active row is already known.
  } else {
    const matchStartTime = Date.now();
    matchingStartAt = new Date(matchStartTime).toISOString();
    const finalMatch = await matchAsync(parsedResult.entity ?? '', entities, tableId, {
      useCache: true,
      usePhonetic: true,
      useFuzzy: true,
      fuzzyThreshold: 4,
    });
    matchingEndAt = new Date().toISOString();

    // `finalMatch` is the real matcher chain's verdict (Exact/Phonetic/Fuzzy/
    // Vector) against the actual row labels — it's the only source of truth
    // for whether `parsedResult.entity` (the LLM's raw transcript extraction,
    // e.g. "1.74" from a mis-heard "John 74") corresponds to a real row.
    // `parsedResult.entityMatch` is NOT a real match result: the parse prompt
    // explicitly tells the LLM not to attempt matching, and the JSON schema
    // it echoes back always carries the example's confidence: 1.0. Falling
    // back to either of those on a matcher miss would report a fabricated
    // high-confidence match for an entity that doesn't exist in the schema.
    matchedEntity = finalMatch.matched;
    matchConfidence = finalMatch.confidence;
    matchType = matchedEntity ? 'semantic' : null;
    if (matchType) matchingTierUsed = matchType;
  }

  const responsePayload: VoiceEntryResult = {
    ...parsedResult,
    entity: matchedEntity,
    entityMatch: {
      original: parsedResult.entity,
      matched: matchedEntity,
      confidence: matchConfidence,
      matchType,
    },
    value: parsed.value,
    valueValid: parsed.valid,
    // No real match against the schema — ask the user instead of silently
    // committing (or crashing downstream on) an unresolved entity. This only
    // applies when an entity WAS spoken but couldn't be resolved; the
    // no-entity-spoken case above always resolves to the active row.
    action: matchedEntity ? parsedResult.action : 'AMBIGUOUS',
    duration: totalDuration,
    error: parsed.valid ? parsedResult.error : (parsed.error ?? parsedResult.error),
    transcript,
    transcriptionDuration,
    parsingDuration,
    totalDuration,
    cached: false,
    matchType: matchedEntity ? matchType ?? 'semantic' : undefined,
    pathTaken: 'LLM_FALLBACK',
    telemetry: buildTelemetry(matchedEntity),
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
