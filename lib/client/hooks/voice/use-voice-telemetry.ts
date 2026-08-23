/**
 * Voice Interaction Telemetry Collector
 * docs/features/19_voice_telemetry.md §7
 *
 * A module-level singleton (not a React hook, despite the file name matching
 * the other voice hooks) — the requestId it tracks must survive across
 * hooks that don't share a React tree position: push-to-talk
 * (use-voice-entry.ts / use-voice-pipeline.ts) and VAD/continuous
 * (use-vad.ts / use-continuous-voice.ts) each own separate capture points
 * for the same interaction, and neither is a descendant of the other.
 */

import { useUIStore } from '@/lib/client/stores/ui-store';
import type { ConfirmationRoute, ServerTelemetrySpans, VoiceInteractionMetrics } from '@/lib/shared/types/voice-telemetry';

export type VoiceTelemetryTimestampField =
  | 'vadStartAt'
  | 'recordingStopAt'
  | 'uploadCompleteAt'
  | 'transcriptionStartAt'
  | 'transcriptionEndAt'
  | 'llmParseStartAt'
  | 'llmParseEndAt'
  | 'matchingStartAt'
  | 'matchingEndAt'
  | 'confirmShownAt'
  | 'confirmReceivedAt'
  | 'dbWriteAckAt';

const pending = new Map<string, VoiceInteractionMetrics>();

function nowIso(): string {
  return new Date().toISOString();
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers) —
  // telemetry correlation only, never used for anything security-sensitive.
  return `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Starts tracking a new interaction, stamping `vadStartAt` as now (the
 * mic-open moment in both capture sites — see §7's capture point table).
 * Returns the generated requestId.
 */
function begin(): string {
  const requestId = generateRequestId();
  pending.set(requestId, { requestId, vadStartAt: nowIso() });
  return requestId;
}

/** Stamps a single timestamp field on an in-flight interaction. No-op if the requestId isn't tracked (e.g. already flushed). */
function mark(requestId: string, field: VoiceTelemetryTimestampField, atIso: string = nowIso()): void {
  const entry = pending.get(requestId);
  if (!entry) return;
  entry[field] = atIso;
}

/** Records the route this interaction reached (or failed to reach) a DB write — see Constraint 2. */
function setConfirmationRoute(requestId: string, route: ConfirmationRoute): void {
  const entry = pending.get(requestId);
  if (!entry) return;
  entry.confirmationRoute = route;
}

/** Merges server-returned spans (the `telemetry` field on the /api/voice-entry response) into the in-flight entry. */
function merge(requestId: string, spans: ServerTelemetrySpans | undefined): void {
  if (!spans) return;
  const entry = pending.get(requestId);
  if (!entry) return;
  Object.assign(entry, spans);
}

/**
 * Fire-and-forget flush to /api/voice-telemetry. Never awaited by any
 * user-facing code path — failure is caught and warned, never thrown, so
 * this can never delay the confirmation flow. Removes the entry regardless
 * of outcome, so a duplicate flush() call for the same requestId is a safe
 * no-op.
 */
function flush(requestId: string): void {
  const entry = pending.get(requestId);
  pending.delete(requestId);
  if (!entry) return;

  // §7 — read at flush time rather than captured earlier, since the
  // shadow transcript keeps growing for the duration of the utterance.
  const interimTranscript = useUIStore.getState().provisionalFeedback.interimTranscript;
  if (interimTranscript) {
    entry.webSttTranscript = interimTranscript;
  }

  fetch('/api/voice-telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch((error) => {
    console.warn('[voiceTelemetry] Flush failed:', error);
  });
}

export const voiceTelemetry = { begin, mark, setConfirmationRoute, merge, flush };
