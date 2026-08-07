/**
 * Voice Input Error Types
 * Based on: docs/09_ERROR_HANDLING.md §2.1
 */

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  RECORDING = 'recording',
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  EXTERNAL_API = 'external_api',
  DATABASE = 'database',
  PARSING = 'parsing',
  MATCHING = 'matching',
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  [key: string]: any;
}

/**
 * Base error class for VocalGrid errors
 * Based on: docs/09_ERROR_HANDLING.md §2.1
 */
export class VocalGridError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly isRecoverable: boolean;
  public readonly userMessage: string;
  public readonly context?: ErrorContext;
  public readonly timestamp: Date;

  constructor(
    code: string,
    message: string,
    options: {
      severity: ErrorSeverity;
      category: ErrorCategory;
      isRecoverable: boolean;
      userMessage: string;
      context?: ErrorContext;
    }
  ) {
    super(message);
    this.name = 'VocalGridError';
    this.code = code;
    this.severity = options.severity;
    this.category = options.category;
    this.isRecoverable = options.isRecoverable;
    this.userMessage = options.userMessage;
    this.context = options.context;
    this.timestamp = new Date();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VocalGridError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      isRecoverable: this.isRecoverable,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Recording-specific errors
 * Based on: docs/09_ERROR_HANDLING.md §3.1
 */
export class RecordingError extends VocalGridError {
  constructor(code: string, message: string, context?: ErrorContext) {
    const config = getRecordingErrorConfig(code);
    super(code, message, {
      severity: config.severity,
      category: ErrorCategory.RECORDING,
      isRecoverable: config.isRecoverable,
      userMessage: config.userMessage,
      context,
    });
  }
}

/**
 * Network-specific errors
 * Based on: docs/09_ERROR_HANDLING.md §3.2
 */
export class NetworkError extends VocalGridError {
  constructor(code: string, message: string, context?: ErrorContext) {
    const config = getNetworkErrorConfig(code);
    super(code, message, {
      severity: config.severity,
      category: ErrorCategory.NETWORK,
      isRecoverable: config.isRecoverable,
      userMessage: config.userMessage,
      context,
    });
  }
}

/**
 * Validation-specific errors
 * Based on: docs/09_ERROR_HANDLING.md §3.3
 */
export class ValidationError extends VocalGridError {
  public readonly field?: string;

  constructor(
    code: string,
    message: string,
    field?: string,
    context?: ErrorContext
  ) {
    const config = getValidationErrorConfig(code);
    super(code, message, {
      severity: ErrorSeverity.WARNING,
      category: ErrorCategory.VALIDATION,
      isRecoverable: true,
      userMessage: config.userMessage,
      context,
    });
    this.field = field;
  }
}

/**
 * Error code constants
 * Based on: docs/09_ERROR_HANDLING.md §2.2
 */
export const ErrorCodes = {
  // Recording errors (REC_xxx)
  REC_PERMISSION_DENIED: 'REC_PERMISSION_DENIED',
  REC_NO_MICROPHONE: 'REC_NO_MICROPHONE',
  REC_DEVICE_BUSY: 'REC_DEVICE_BUSY',
  REC_FAILED: 'REC_FAILED',
  REC_TOO_SHORT: 'REC_TOO_SHORT',
  REC_TOO_LONG: 'REC_TOO_LONG',

  // Continuous-mode VAD chunking (VAD_xxx) — docs/05_VOICE_PIPELINE.md §9.5
  VAD_CHUNK_TOO_LONG: 'VAD_CHUNK_TOO_LONG',

  // Speech-to-Text errors (STT_xxx)
  STT_TIMEOUT: 'STT_TIMEOUT',
  STT_NO_SPEECH: 'STT_NO_SPEECH',
  STT_INVALID_AUDIO: 'STT_INVALID_AUDIO',
  STT_RATE_LIMIT: 'STT_RATE_LIMIT',
  STT_API_ERROR: 'STT_API_ERROR',

  // Parsing errors (PARSE_xxx)
  PARSE_NO_MATCH: 'PARSE_NO_MATCH',
  PARSE_AMBIGUOUS: 'PARSE_AMBIGUOUS',
  PARSE_INVALID_VALUE: 'PARSE_INVALID_VALUE',
  PARSE_OUT_OF_RANGE: 'PARSE_OUT_OF_RANGE',
  PARSE_TIMEOUT: 'PARSE_TIMEOUT',

  // Network errors (NET_xxx)
  NET_OFFLINE: 'NET_OFFLINE',
  NET_TIMEOUT: 'NET_TIMEOUT',
  NET_SERVER_ERROR: 'NET_SERVER_ERROR',
  NET_NOT_FOUND: 'NET_NOT_FOUND',

  // Database errors (DB_xxx)
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  DB_CONFLICT: 'DB_CONFLICT',

  // Authentication errors (AUTH_xxx)
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',

  // Validation errors (VAL_xxx)
  VAL_REQUIRED_FIELD: 'VAL_REQUIRED_FIELD',
  VAL_INVALID_FORMAT: 'VAL_INVALID_FORMAT',
  VAL_OUT_OF_RANGE: 'VAL_OUT_OF_RANGE',
  VAL_DUPLICATE: 'VAL_DUPLICATE',

  // Generic
  NO_CELL_SELECTED: 'NO_CELL_SELECTED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Configuration for recording errors
 */
function getRecordingErrorConfig(code: string) {
  const configs: Record<string, { severity: ErrorSeverity; isRecoverable: boolean; userMessage: string }> = {
    [ErrorCodes.REC_PERMISSION_DENIED]: {
      severity: ErrorSeverity.ERROR,
      isRecoverable: false,
      userMessage: 'Microphone access denied. Please enable microphone permissions in your browser settings.',
    },
    [ErrorCodes.REC_NO_MICROPHONE]: {
      severity: ErrorSeverity.ERROR,
      isRecoverable: false,
      userMessage: 'No microphone detected. Please connect a microphone and try again.',
    },
    [ErrorCodes.REC_DEVICE_BUSY]: {
      severity: ErrorSeverity.WARNING,
      isRecoverable: true,
      userMessage: 'Microphone is being used by another application. Please close other apps and try again.',
    },
    [ErrorCodes.REC_FAILED]: {
      severity: ErrorSeverity.ERROR,
      isRecoverable: true,
      userMessage: 'Failed to record audio. Please try again.',
    },
    [ErrorCodes.REC_TOO_SHORT]: {
      severity: ErrorSeverity.WARNING,
      isRecoverable: true,
      userMessage: 'Recording too short. Please speak for at least 1 second.',
    },
    [ErrorCodes.REC_TOO_LONG]: {
      severity: ErrorSeverity.WARNING,
      isRecoverable: true,
      userMessage: 'Recording too long. Please keep recordings under 60 seconds.',
    },
  };

  return configs[code] || {
    severity: ErrorSeverity.ERROR,
    isRecoverable: true,
    userMessage: 'An error occurred while recording. Please try again.',
  };
}

/**
 * Configuration for network errors
 */
function getNetworkErrorConfig(code: string) {
  const configs: Record<string, { severity: ErrorSeverity; isRecoverable: boolean; userMessage: string }> = {
    [ErrorCodes.NET_OFFLINE]: {
      severity: ErrorSeverity.WARNING,
      isRecoverable: true,
      userMessage: 'No internet connection. Your changes will be saved locally and synced when you reconnect.',
    },
    [ErrorCodes.NET_TIMEOUT]: {
      severity: ErrorSeverity.WARNING,
      isRecoverable: true,
      userMessage: 'Request timed out. Please check your connection and try again.',
    },
    [ErrorCodes.NET_SERVER_ERROR]: {
      severity: ErrorSeverity.ERROR,
      isRecoverable: true,
      userMessage: 'Server error. Please try again in a moment.',
    },
    [ErrorCodes.NET_NOT_FOUND]: {
      severity: ErrorSeverity.ERROR,
      isRecoverable: false,
      userMessage: 'The requested resource was not found.',
    },
  };

  return configs[code] || {
    severity: ErrorSeverity.ERROR,
    isRecoverable: true,
    userMessage: 'Network error. Please check your connection and try again.',
  };
}

/**
 * Configuration for validation errors
 */
function getValidationErrorConfig(code: string) {
  const configs: Record<string, { userMessage: string }> = {
    [ErrorCodes.VAL_REQUIRED_FIELD]: {
      userMessage: 'This field is required.',
    },
    [ErrorCodes.VAL_INVALID_FORMAT]: {
      userMessage: 'Invalid format. Please check your input.',
    },
    [ErrorCodes.VAL_OUT_OF_RANGE]: {
      userMessage: 'Value is out of allowed range.',
    },
    [ErrorCodes.VAL_DUPLICATE]: {
      userMessage: 'This value already exists.',
    },
  };

  return configs[code] || {
    userMessage: 'Validation error. Please check your input.',
  };
}

/**
 * Legacy error class for backward compatibility
 * @deprecated Use RecordingError, NetworkError, or ValidationError instead
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

/**
 * Legacy error instances for backward compatibility
 * @deprecated Use ErrorCodes and specific error classes instead
 */
export const VoiceErrors = {
  MIC_PERMISSION_DENIED: new VoiceInputError(
    ErrorCodes.REC_PERMISSION_DENIED,
    'Microphone access denied. Please allow microphone access in your browser settings.',
    false
  ),
  MIC_NOT_FOUND: new VoiceInputError(
    ErrorCodes.REC_NO_MICROPHONE,
    'No microphone detected. Please connect a microphone and try again.',
    false
  ),
  RECORDING_FAILED: new VoiceInputError(
    ErrorCodes.REC_FAILED,
    'Failed to record audio. Please try again.',
    true
  ),
  STT_TIMEOUT: new VoiceInputError(
    ErrorCodes.STT_TIMEOUT,
    'Transcription timed out. Please try a shorter recording.',
    true
  ),
  STT_NO_SPEECH: new VoiceInputError(
    ErrorCodes.STT_NO_SPEECH,
    'No speech detected. Please speak louder or closer to the microphone.',
    true
  ),
  STT_RATE_LIMIT: new VoiceInputError(
    ErrorCodes.STT_RATE_LIMIT,
    'Too many requests. Please wait a moment and try again.',
    true
  ),
  PARSE_NO_MATCH: new VoiceInputError(
    ErrorCodes.PARSE_NO_MATCH,
    'Could not identify the entity. Please try again.',
    true
  ),
  PARSE_AMBIGUOUS: new VoiceInputError(
    ErrorCodes.PARSE_AMBIGUOUS,
    'Multiple matches found. Please clarify.',
    true
  ),
  PARSE_INVALID_VALUE: new VoiceInputError(
    ErrorCodes.PARSE_INVALID_VALUE,
    'Invalid value for this column type.',
    true
  ),
  PARSE_FAILED: new VoiceInputError(
    'PARSE_FAILED',
    'Parsing failed. Please try again.',
    true
  ),
  NO_CELL_SELECTED: new VoiceInputError(
    ErrorCodes.NO_CELL_SELECTED,
    'No cell selected. Click a cell before recording.',
    true
  ),
};
