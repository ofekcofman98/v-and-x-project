import type { TableSchema } from '@/lib/shared/types/table-schema';
import { transcriptCache } from '@/lib/server/cache/transcript-cache';
import { entityCache } from '@/lib/server/cache/entity-recognition-cache';
import { ErrorCodes, ErrorSeverity, ErrorCategory, VocalGridError } from '@/lib/shared/types/voice-errors';
import { buildWhisperPrompt as buildContextPrompt } from '@/lib/server/stt/context-prompt';
import { openai } from './openai-client';

// Default ON — set ENABLE_STT_CONTEXT_PROMPT=false to disable vocabulary
// injection (e.g. to A/B the exact-match rate per docs/features/10 §2.3).
export const STT_CONTEXT_PROMPT_ENABLED = process.env.ENABLE_STT_CONTEXT_PROMPT !== 'false';

// ─────────────────────────────────────────────────────────────────────────────
// Transcription
// ─────────────────────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  transcript: string;
  transcriptionDuration: number;
  /** True when the result was served from the transcript cache. */
  transcriptFromCache: boolean;
  /** Audio duration in seconds, when known (verbose_json only). */
  audioDurationSec?: number;
  /** Vocabulary entities injected into the Whisper prompt, for the hallucination guard. */
  promptEntities: string[];
}

export async function transcribeAudio(
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
