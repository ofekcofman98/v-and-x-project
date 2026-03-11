/**
 * Voice Input Error Types
 * Based on: docs/05_VOICE_PIPELINE.md §6.1
 */

export class VoiceInputError extends Error {
  constructor(
    public code: string,
    message: string,
    public recoverable: boolean = true,
    public context?: any
  ) {
    super(message);
    this.name = 'VoiceInputError';
  }
}

export const VoiceErrors = {
  // Recording errors
  MIC_PERMISSION_DENIED: new VoiceInputError(
    'MIC_PERMISSION_DENIED',
    'Microphone access denied. Please allow microphone access in your browser settings.',
    false
  ),

  MIC_NOT_FOUND: new VoiceInputError(
    'MIC_NOT_FOUND',
    'No microphone detected. Please connect a microphone and try again.',
    false
  ),

  RECORDING_FAILED: new VoiceInputError(
    'RECORDING_FAILED',
    'Failed to record audio. Please try again.',
    true
  ),

  // STT errors
  STT_TIMEOUT: new VoiceInputError(
    'STT_TIMEOUT',
    'Transcription timed out. Please try a shorter recording.',
    true
  ),

  STT_NO_SPEECH: new VoiceInputError(
    'STT_NO_SPEECH',
    'No speech detected. Please speak louder or closer to the microphone.',
    true
  ),

  STT_RATE_LIMIT: new VoiceInputError(
    'STT_RATE_LIMIT',
    'Too many requests. Please wait a moment and try again.',
    true
  ),

  // Parsing errors
  PARSE_NO_MATCH: new VoiceInputError(
    'PARSE_NO_MATCH',
    'Could not identify the entity. Please try again.',
    true
  ),

  PARSE_AMBIGUOUS: new VoiceInputError(
    'PARSE_AMBIGUOUS',
    'Multiple matches found. Please clarify.',
    true
  ),

  PARSE_INVALID_VALUE: new VoiceInputError(
    'PARSE_INVALID_VALUE',
    'Invalid value for this column type.',
    true
  ),

  PARSE_FAILED: new VoiceInputError(
    'PARSE_FAILED',
    'Parsing failed. Please try again.',
    true
  ),

  // Generic
  NO_CELL_SELECTED: new VoiceInputError(
    'NO_CELL_SELECTED',
    'No cell selected. Click a cell before recording.',
    true
  ),
};
