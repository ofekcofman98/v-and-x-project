/**
 * Voice Entry Service — public barrel.
 * Implementation is split by concern across this folder:
 *   pipeline.ts             — processVoiceEntry() orchestrator
 *   transcription.ts        — Whisper transcription + prompt/segment handling
 *   hallucination.ts        — Whisper hallucination detection
 *   row-first.ts            — Row-first mid-row detection
 *   bare-value.ts           — Bare-value fast path resolution
 *   quick-extract.ts        — Regex fast-path entity/value extraction
 *   llm-prompts.ts          — GPT prompt builders + output parsing
 *   parse-context.ts        — Language → ParseContext mapping
 *   performance-logging.ts  — Performance budget + metrics logging
 *   openai-client.ts        — Shared OpenAI client singleton
 *
 * Based on: docs/05_VOICE_PIPELINE.md, docs/10_PERFORMANCE.md
 */

export { processVoiceEntry } from './pipeline';
export { resolveBareValueEntry } from './bare-value';
export { resolveFirstEditableColumnId, isRowFirstMidRow } from './row-first';
export { isWhisperHallucination } from './hallucination';

export type { ProcessingPath, VoiceEntryPayload, VoiceEntryResult } from '@/lib/shared/types/voice-pipeline';
