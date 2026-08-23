// docs/features/19_voice_telemetry.md §8 — Data Contract

export type MatchingTier = 'exact' | 'phonetic' | 'fuzzy' | 'semantic' | 'none';

/** How a voice interaction reached (or failed to reach) a DB write. See §3 Constraint 2. */
export type ConfirmationRoute = 'auto' | 'confirmed' | 'batch' | 'abandoned';

/**
 * Full set of stage timestamps, precomputed durations, and (flag-gated)
 * accuracy fields for one voice interaction. Assembled incrementally across
 * the client hooks and server pipeline, keyed by `requestId`, and flushed
 * once to POST /api/voice-telemetry.
 */
export interface VoiceInteractionMetrics {
  /** Only required field — everything else is built up incrementally. */
  requestId: string;

  vadStartAt?: string;
  recordingStopAt?: string;
  uploadCompleteAt?: string;
  transcriptionStartAt?: string;
  transcriptionEndAt?: string;
  llmParseStartAt?: string;
  llmParseEndAt?: string;
  matchingStartAt?: string;
  matchingEndAt?: string;
  confirmShownAt?: string;
  confirmReceivedAt?: string;
  dbWriteAckAt?: string;

  confirmationRoute?: ConfirmationRoute;

  /** Accuracy/trace fields — populated only when VOICE_ACCURACY_TELEMETRY_ENABLED is true. */
  webSttTranscript?: string;
  whisperTranscript?: string;
  matchedEntityValue?: string;
  matchingTierUsed?: MatchingTier;
}

/**
 * Subset of server-side spans returned on the /api/voice-entry response so the
 * client can merge them into its own in-flight VoiceInteractionMetrics entry.
 */
export interface ServerTelemetrySpans {
  transcriptionStartAt?: string;
  transcriptionEndAt?: string;
  llmParseStartAt?: string;
  llmParseEndAt?: string;
  matchingStartAt?: string;
  matchingEndAt?: string;
  matchingTierUsed?: MatchingTier;
  whisperTranscript?: string;
  matchedEntityValue?: string;
}
