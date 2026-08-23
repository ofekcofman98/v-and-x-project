/**
 * Central model + tuning constants for every OpenAI call in the app.
 * Single source of truth so a model swap or budget change is a one-line
 * edit instead of a repo-wide grep. Named per `.claude/rules/typescript.md`
 * ("no magic strings or numbers").
 */

export const AI_MODELS = {
  CHAT: 'gpt-4o-mini',
  TRANSCRIPTION: 'whisper-1',
  TTS: 'tts-1',
  TTS_VOICE: 'alloy',
} as const;

export const AI_LIMITS = {
  /** Max tool-calling rounds per agent turn (grid-agent, global-agent). */
  MAX_TOOL_ROUNDS: 3,
  /** Max correction rounds (invalid tool args) before an agent turn bails. */
  MAX_CORRECTION_ROUNDS: 2,
  /** Max retries on Zod validation failure for structured-output LLM calls. */
  MAX_RETRIES: 1,
} as const;

export const AI_TUNING = {
  /** Low temperature for deterministic structured-output JSON calls. */
  JSON_TEMPERATURE: 0.1,
  /** Whisper temperature — 0 reduces hallucination amplification. */
  TRANSCRIPTION_TEMPERATURE: 0,
  MAX_TOKENS: {
    SCHEMA_DRAFT: 800,
    SEGMENTATION: 512,
    PARSE: 256,
    VALUE_ONLY: 64,
  },
} as const;
