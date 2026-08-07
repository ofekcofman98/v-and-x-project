// ─────────────────────────────────────────────────────────────────────────────
// Batch voice entry orchestrator
// docs/features/03_ai_table_agent.md §5.5
//
// Ties detection (batch-detect) → segmentation (batch-segmentation, falling
// back to batch-llm-segmentation) → resolution (batch-resolve, batch-row-first)
// into one VoiceBatchResult. Everything upstream of resolution is
// navigation-mode-specific; the result shape and everything downstream
// (commit, invalidation, pointer advance, confirmation UI) is shared.
// ─────────────────────────────────────────────────────────────────────────────

import type { VoiceEntryPayload } from '@/lib/shared/types/voice-pipeline';
import type { BatchCellWrite, VoiceBatchResult } from '@/lib/shared/types/voice-pipeline';
import { segmentBareValuesLocal, segmentEntityValuePairsLocal } from './batch-segmentation';
import { segmentBareValuesViaLLM, segmentEntityValuePairsViaLLM } from './batch-llm-segmentation';
import { resolveColumnFirstEntry, resolveRowFirstEntry } from './batch-resolve';
import { resolveRowFirstColumnTargets } from './batch-row-first';
import { toParseContext } from './parse-context';

/**
 * Thrown when neither local nor LLM segmentation can make sense of a
 * transcript that tripped the batch-detection gate. The caller (pipeline.ts)
 * catches this and degrades to treating the transcript as single-entry,
 * per docs/features/03_ai_table_agent.md §5.3's fallback table.
 */
export class BatchSegmentationFailedError extends Error {
  constructor() {
    super('Batch segmentation failed for both local and LLM strategies');
    this.name = 'BatchSegmentationFailedError';
  }
}

async function resolveRowFirstBatch(
  transcript: string,
  payload: VoiceEntryPayload
): Promise<{ writes: BatchCellWrite[]; overflowCount: number; pathTaken: VoiceBatchResult['pathTaken'] }> {
  const { tableSchema, activeCell } = payload;
  const ctx = toParseContext(payload.language);

  const activeRow = tableSchema.rows.find((r) => r.id === activeCell.rowKey);
  if (!activeRow) {
    throw new BatchSegmentationFailedError();
  }

  let rawValues = segmentBareValuesLocal(transcript);
  let pathTaken: VoiceBatchResult['pathTaken'] = 'BATCH_LOCAL_SEGMENTATION';

  if (!rawValues) {
    console.log('[VoiceEntryService][Batch] Local bare-value segmentation ambiguous, trying LLM:', transcript);
    try {
      rawValues = await segmentBareValuesViaLLM(transcript);
      pathTaken = 'BATCH_LLM_SEGMENTATION';
    } catch (err) {
      console.warn('[VoiceEntryService][Batch] LLM bare-value segmentation failed, degrading to single-entry:', {
        transcript,
        error: err instanceof Error ? err.message : err,
      });
      throw new BatchSegmentationFailedError();
    }
  }

  const { targets, overflowCount } = resolveRowFirstColumnTargets(activeCell, tableSchema, rawValues.length);
  const writes = targets.map((column, i) => resolveRowFirstEntry(rawValues![i], column, activeRow, ctx));

  return { writes, overflowCount, pathTaken };
}

async function resolveColumnFirstBatch(
  transcript: string,
  payload: VoiceEntryPayload
): Promise<{ writes: BatchCellWrite[]; overflowCount: number; pathTaken: VoiceBatchResult['pathTaken'] }> {
  const { tableSchema, activeCell, tableId } = payload;
  const ctx = toParseContext(payload.language);

  const activeColumn = tableSchema.columns.find((c) => c.id === activeCell.tableColumnId);
  if (!activeColumn) {
    throw new BatchSegmentationFailedError();
  }

  let pairs = segmentEntityValuePairsLocal(transcript, activeColumn, ctx);
  let pathTaken: VoiceBatchResult['pathTaken'] = 'BATCH_LOCAL_SEGMENTATION';

  if (!pairs) {
    console.log('[VoiceEntryService][Batch] Local entity-value segmentation ambiguous, trying LLM:', transcript);
    try {
      pairs = await segmentEntityValuePairsViaLLM(transcript);
      pathTaken = 'BATCH_LLM_SEGMENTATION';
    } catch (err) {
      console.warn('[VoiceEntryService][Batch] LLM entity-value segmentation failed, degrading to single-entry:', {
        transcript,
        error: err instanceof Error ? err.message : err,
      });
      throw new BatchSegmentationFailedError();
    }
  }

  const writes = await Promise.all(
    pairs.map((entry) => resolveColumnFirstEntry(entry, tableSchema, activeColumn, tableId, ctx))
  );

  return { writes, overflowCount: 0, pathTaken };
}

/**
 * Runs the batch sub-pipeline for a transcript that has already tripped
 * `looksLikeBatchUtterance`. Forks on navigation mode: column-first produces
 * (entity, value) pairs resolved against row labels; row-first produces
 * bare values mapped to the next editable columns in the current row.
 */
export async function processVoiceEntryBatch(
  transcript: string,
  payload: VoiceEntryPayload,
  timings: { transcriptionDuration: number; totalStartTime: number }
): Promise<VoiceBatchResult> {
  console.log('[VoiceEntryService][Batch] Detection gate tripped:', {
    transcript,
    navigationMode: payload.navigationMode,
  });

  const parsingStartTime = Date.now();

  const { writes, overflowCount, pathTaken } =
    payload.navigationMode === 'row-first'
      ? await resolveRowFirstBatch(transcript, payload)
      : await resolveColumnFirstBatch(transcript, payload);

  const parsingDuration = Date.now() - parsingStartTime;
  const totalDuration = Date.now() - timings.totalStartTime;

  const routeTally = writes.reduce<Record<string, number>>((tally, w) => {
    tally[w.confidenceRoute] = (tally[w.confidenceRoute] ?? 0) + 1;
    return tally;
  }, {});

  console.log('[VoiceEntryService][Batch] Complete:', {
    transcript,
    pathTaken,
    segmentCount: writes.length,
    overflowCount,
    routeTally,
    parsingDuration,
    totalDuration,
  });

  return {
    isBatch: true,
    writes,
    overflowCount,
    transcript,
    transcriptionDuration: timings.transcriptionDuration,
    parsingDuration,
    totalDuration,
    pathTaken,
  };
}
