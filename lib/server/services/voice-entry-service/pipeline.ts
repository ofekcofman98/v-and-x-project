/**
 * Voice Entry Pipeline
 * Implements the complete voice entry processing pipeline.
 *
 * Extracted from: app/api/voice-entry/route.ts
 * Based on: docs/05_VOICE_PIPELINE.md, docs/10_PERFORMANCE.md
 *
 * Pipeline stages:
 *   1. Transcript cache check → Whisper transcription
 *   2. Hallucination guard
 *   3. Resolve active column/row (+ 3.5: Row-first mid-row shortcut)
 *   4. Entity recognition cache check
 *   5. Fast-path (regex extraction + non-LLM matching, Levels 1–3)
 *   6. LLM fallback (GPT-4o-mini, Level 4)
 *
 * Error contract:
 *   All known failure modes throw VocalGridError so the HTTP layer can map
 *   error codes to status codes without embedding business logic.
 */

import type { MatchType, VoiceEntryPayload, VoiceEntryResult } from '@/lib/shared/types/voice-pipeline';
import { parseForColumn } from '@/lib/server/parsers/registry';
import { matchAsync } from '@/lib/server/matching/matcher';
import { entityCache } from '@/lib/server/cache/entity-recognition-cache';
import { ErrorCodes, ErrorSeverity, ErrorCategory, VocalGridError } from '@/lib/shared/types/voice-errors';
import { openai } from './openai-client';
import { transcribeAudio } from './transcription';
import { isWhisperHallucination } from './hallucination';
import { isRowFirstMidRow } from './row-first';
import { resolveBareValueEntry } from './bare-value';
import { extractEntityQuick } from './quick-extract';
import { toParseContext } from './parse-context';
import { buildParsePrompt, extractValueOnlyViaLLM, parseCompletion } from './llm-prompts';
import { logPerformanceStats } from './performance-logging';

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

  // ── Stage 3.5: Row-first mid-row shortcut ─────────────────────────────────
  // Past the row's first editable column, Row-First deterministically knows
  // there is no entity to resolve — the pointer already identifies the row.
  // Skip entity cache, quick-extraction, and LLM entity matching entirely.
  // Unlike Optimisation 2.5 below (a content-based guess restricted to
  // non-TEXT columns), this applies to ALL column types, because navigation
  // state — not transcript content — is what tells us no entity is expected.
  if (isRowFirstMidRow(navigationMode, activeCell, tableSchema)) {
    const parseCtx = toParseContext(language);
    const directParse = parseForColumn(transcript.trim(), activeColumn, parseCtx);

    if (directParse.valid) {
      console.log('[VoiceEntryService] 🎯 FAST_PATH: Row-first mid-row value (no entity resolution)');
      const parsingDuration = Date.now() - parsingStartTime;
      const totalDuration = Date.now() - totalStartTime;

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
    const rawValue = await extractValueOnlyViaLLM(transcript, activeColumn);
    const llmDuration = Date.now() - llmStartTime;
    const valueParsed = parseForColumn(rawValue, activeColumn, parseCtx);
    const totalDuration = Date.now() - totalStartTime;

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

  // ── Optimisation 2.5: Bare-value fast path ────────────────────────────────
  // activeCell already identifies the row (via click, or via Smart Pointer
  // row-first advance) — a lone value needs no entity restated. Only
  // reachable when quickExtract's "Entity, value" pattern didn't match.
  if (!quickExtract) {
    const bareValue = resolveBareValueEntry(transcript, activeColumn, activeRow, toParseContext(language));

    if (bareValue) {
      console.log('[VoiceEntryService] 🎯 FAST_PATH: Bare value for already-selected cell');
      const parsingDuration = Date.now() - parsingStartTime;
      const totalDuration = Date.now() - totalStartTime;

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
  const parsed = parseForColumn(parsedResult.value, activeColumn, toParseContext(language));
  const totalDuration = Date.now() - totalStartTime;

  // GPT was explicitly instructed (buildParsePrompt) to report entity: null
  // when the transcript is a bare value with no name/entity mentioned at
  // all. In that case there is nothing to match against the schema — the
  // activeCell (click, or Smart Pointer row-first advance) already tells us
  // which row this is. Only when GPT reports an actual spoken entity do we
  // run it through the matcher chain and risk AMBIGUOUS.
  const noEntitySpoken = !parsedResult.entity || parsedResult.entity.trim().length === 0;

  let matchedEntity: string | null;
  let matchConfidence: number;
  let matchType: MatchType | null;

  if (noEntitySpoken) {
    matchedEntity = activeRow.label;
    matchConfidence = 1;
    matchType = 'exact';
  } else {
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
    matchedEntity = finalMatch.matched;
    matchConfidence = finalMatch.confidence;
    matchType = matchedEntity ? 'semantic' : null;
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
