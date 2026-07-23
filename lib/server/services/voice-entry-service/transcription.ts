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

export interface TranscribeAudioOptions {
  /**
   * Row-First mid-row value-only entries never contain an entity name — biasing
   * Whisper's decoder toward the row-label vocabulary anyway (via the `prompt`
   * param) appears to push short, non-matching bare-value audio into Whisper's
   * empty-output behavior. Swap the vocabulary prompt for a lightweight
   * value-oriented hint for these deterministically value-only requests, so
   * short spoken numbers/status words aren't discarded as silence either.
   * docs/06_SMART_POINTER_LOGS.md
   */
  suppressVocabPrompt?: boolean;
}

// Lightweight decoder hint for Row-First mid-row (value-only) utterances —
// primes Whisper for short numeric/status speech instead of person-name
// vocabulary, without reintroducing the entity-biasing that caused the
// empty-transcript regression. docs/06_SMART_POINTER_LOGS.md
const VALUE_ONLY_PROMPT_HINT = 'Numbers, grades, values, 85, 90, 100, yes, no, כן, לא, מעולה';

// Whisper's `language` param defaults to auto-detection when omitted —
// on quiet/ambient audio that lets it misidentify silence as speech in the
// wrong language, amplifying the repetition-loop failure mode. Always pass
// an explicit language; 'en' is this app's default when the caller doesn't
// specify 'he'. docs/06_SMART_POINTER_LOGS.md
const DEFAULT_WHISPER_LANGUAGE: 'en' | 'he' = 'en';

export async function transcribeAudio(
  audioFile: File,
  tableSchema: TableSchema,
  language: string | undefined,
  tableId: string,
  startTime: number,
  opts?: TranscribeAudioOptions
): Promise<TranscriptionResult> {
  const cached = await transcriptCache.get(audioFile);

  if (cached) {
    console.log('[VoiceEntryService] 🚀 TRANSCRIPT_CACHE_HIT: Saved 1300ms transcription');
    return { transcript: cached.text, transcriptionDuration: 0, transcriptFromCache: true, promptEntities: [] };
  }

  try {
    const whisperPrompt = opts?.suppressVocabPrompt
      ? VALUE_ONLY_PROMPT_HINT
      : buildWhisperPrompt(tableSchema, tableId);
    const promptUsed = STT_CONTEXT_PROMPT_ENABLED && whisperPrompt.length > 0;

    console.log('[VoiceEntryService] Audio received:', {
      byteSize: audioFile.size,
      mimeType: audioFile.type,
    });

    const whisperLanguage: 'en' | 'he' = language === 'he' ? 'he' : DEFAULT_WHISPER_LANGUAGE;

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: whisperLanguage,
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
    console.log('[VoiceEntryService] Transcription complete:', {
      transcript,
      duration: transcriptionDuration,
      audioByteSize: audioFile.size,
      audioDurationSec,
      promptUsed,
      language: whisperLanguage,
    });

    // The value-only hint isn't entity vocabulary — only populate
    // promptEntities (used by the hallucination guard's prompt-echo check)
    // when the actual row-label vocabulary prompt was used.
    const usedEntityVocabPrompt = promptUsed && !opts?.suppressVocabPrompt;

    return {
      transcript,
      transcriptionDuration,
      transcriptFromCache: false,
      audioDurationSec,
      promptEntities: usedEntityVocabPrompt ? tableSchema.rows.map((r) => r.label) : [],
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
