/**
 * Voice Interaction Telemetry — write path.
 * docs/features/19_voice_telemetry.md §6, §12
 *
 * Single-flush model: each interaction is expected to report exactly once
 * (at db-write-ack, cancel, or a terminal error), so `create` is used rather
 * than an `upsert` on requestId — see §12 for why this assumption might change.
 */

import { prisma } from '@/lib/prisma';
import { VOICE_ACCURACY_TELEMETRY_ENABLED } from './config';
import type { VoiceInteractionMetrics, VoiceInteractionTarget } from '@/lib/shared/types/voice-telemetry';
import { Prisma } from '@/lib/shared/generated/prisma/client';

/**
 * Strips written cell values from targets when accuracy telemetry is off —
 * values are raw content, same category as the transcript fields. rowKey/
 * tableColumnId (identifying *which* cell, not what was written) always pass.
 *
 * `matchingTier`/`matchedEntity` (the batch path's per-target equivalent of
 * the top-level matchingTierUsed/matchedEntityValue) are stripped alongside
 * value for the same reason those top-level fields live inside
 * `accuracyFields` below: matchedEntity is a row label (content), and
 * matchingTier is kept behind the same gate for consistency between the two
 * representations rather than splitting the flag's meaning in two.
 */
function toStoredTargets(targets: VoiceInteractionTarget[] | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!targets || targets.length === 0) return Prisma.JsonNull;

  const stored = VOICE_ACCURACY_TELEMETRY_ENABLED
    ? targets
    : targets.map(({ rowKey, tableColumnId }) => ({ rowKey, tableColumnId }));

  return stored as Prisma.InputJsonValue;
}

/** Parses an ISO timestamp string to a Date, or null if absent/invalid. */
function toDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** ms between two ISO timestamps, or null when either is missing (never negative). */
function durationMs(startIso: string | undefined, endIso: string | undefined): number | null {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (!start || !end) return null;

  const diff = end.getTime() - start.getTime();
  return diff >= 0 ? diff : null;
}

/**
 * Persists one voice interaction row. Never throws — a telemetry write
 * failure must never interrupt the confirmation/write flow it's observing.
 */
export async function recordVoiceInteraction(metrics: VoiceInteractionMetrics): Promise<void> {
  try {
    const accuracyFields = VOICE_ACCURACY_TELEMETRY_ENABLED
      ? {
          webSttTranscript: metrics.webSttTranscript ?? null,
          whisperTranscript: metrics.whisperTranscript ?? null,
          matchedEntityValue: metrics.matchedEntityValue ?? null,
          matchingTierUsed: metrics.matchingTierUsed ?? null,
        }
      : {
          webSttTranscript: null,
          whisperTranscript: null,
          matchedEntityValue: null,
          matchingTierUsed: null,
        };

    await prisma.voiceInteraction.create({
      data: {
        requestId: metrics.requestId,

        vadStartAt: toDate(metrics.vadStartAt),
        recordingStopAt: toDate(metrics.recordingStopAt),
        uploadCompleteAt: toDate(metrics.uploadCompleteAt),
        transcriptionStartAt: toDate(metrics.transcriptionStartAt),
        transcriptionEndAt: toDate(metrics.transcriptionEndAt),
        llmParseStartAt: toDate(metrics.llmParseStartAt),
        llmParseEndAt: toDate(metrics.llmParseEndAt),
        matchingStartAt: toDate(metrics.matchingStartAt),
        matchingEndAt: toDate(metrics.matchingEndAt),
        confirmShownAt: toDate(metrics.confirmShownAt),
        confirmReceivedAt: toDate(metrics.confirmReceivedAt),
        dbWriteAckAt: toDate(metrics.dbWriteAckAt),

        recordingDurationMs: durationMs(metrics.vadStartAt, metrics.recordingStopAt),
        transcriptionDurationMs: durationMs(metrics.transcriptionStartAt, metrics.transcriptionEndAt),
        llmParseDurationMs: durationMs(metrics.llmParseStartAt, metrics.llmParseEndAt),
        matchingDurationMs: durationMs(metrics.matchingStartAt, metrics.matchingEndAt),
        confirmWaitDurationMs: durationMs(metrics.confirmShownAt, metrics.confirmReceivedAt),
        totalDurationMs: durationMs(metrics.vadStartAt, metrics.dbWriteAckAt),

        confirmationRoute: metrics.confirmationRoute ?? null,
        navigationMode: metrics.navigationMode ?? null,
        wasBatch: metrics.wasBatch ?? null,
        targets: toStoredTargets(metrics.targets),

        ...accuracyFields,
      },
    });
  } catch (error) {
    console.warn('[VoiceInteractionService] Failed to record voice interaction telemetry:', error);
  }
}
