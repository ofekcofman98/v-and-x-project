/**
 * Global Error Mapping
 * Maps error codes to user-friendly messages
 * Based on: docs/09_ERROR_HANDLING.md §7.1
 */

import { ErrorCodes } from '@/lib/shared/types/voice-errors';

export interface ErrorMapping {
  title: string;
  message: string;
  action?: string;
}

/**
 * User-friendly error messages mapping
 * Based on: docs/09_ERROR_HANDLING.md §7.1
 */
export const ErrorMessages: Record<string, ErrorMapping> = {
  // Recording errors
  [ErrorCodes.REC_PERMISSION_DENIED]: {
    title: 'Microphone Access Needed',
    message: 'To use voice input, please allow microphone access in your browser settings.',
    action: 'Open Settings',
  },
  [ErrorCodes.REC_NO_MICROPHONE]: {
    title: 'No Microphone Found',
    message: 'No microphone detected. Please connect a microphone and try again.',
    action: 'Try Again',
  },
  [ErrorCodes.REC_DEVICE_BUSY]: {
    title: 'Microphone In Use',
    message: 'Microphone is being used by another application. Please close other apps and try again.',
    action: 'Try Again',
  },
  [ErrorCodes.REC_FAILED]: {
    title: 'Recording Failed',
    message: 'Failed to record audio. Please try again.',
    action: 'Try Again',
  },
  [ErrorCodes.REC_TOO_SHORT]: {
    title: 'Recording Too Short',
    message: 'Recording too short. Please speak for at least 1 second.',
    action: 'Try Again',
  },
  [ErrorCodes.REC_TOO_LONG]: {
    title: 'Recording Too Long',
    message: 'Recording too long. Please keep recordings under 60 seconds.',
    action: 'Try Again',
  },

  // Continuous-mode VAD chunking — informational, not an error; continuous
  // mode keeps listening. docs/05_VOICE_PIPELINE.md §9.5
  [ErrorCodes.VAD_CHUNK_TOO_LONG]: {
    title: 'Long Input Detected',
    message: 'Long input detected — processing what was said so far.',
  },

  // Speech-to-Text errors
  [ErrorCodes.STT_TIMEOUT]: {
    title: 'Transcription Timeout',
    message: 'Speech recognition timed out. Please try again.',
    action: 'Try Again',
  },
  [ErrorCodes.STT_NO_SPEECH]: {
    title: 'No Speech Detected',
    message: "We couldn't hear you. Try speaking a bit louder or closer to the microphone.",
    action: 'Try Again',
  },
  [ErrorCodes.STT_INVALID_AUDIO]: {
    title: 'Invalid Audio',
    message: 'Invalid audio format. Please try recording again.',
    action: 'Try Again',
  },
  [ErrorCodes.STT_RATE_LIMIT]: {
    title: 'Rate Limit Exceeded',
    message: 'Too many requests. Please wait a moment and try again.',
    action: 'Try Again',
  },
  [ErrorCodes.STT_API_ERROR]: {
    title: 'Transcription Error',
    message: 'Speech recognition service error. Please try again.',
    action: 'Try Again',
  },

  // Parsing errors
  [ErrorCodes.PARSE_NO_MATCH]: {
    title: 'Name Not Found',
    message: "We couldn't find that name in the table. Would you like to add it?",
    action: 'Try Again',
  },
  [ErrorCodes.PARSE_AMBIGUOUS]: {
    title: 'Multiple Matches',
    message: 'Multiple matches found. Please be more specific.',
    action: 'Try Again',
  },
  [ErrorCodes.PARSE_INVALID_VALUE]: {
    title: 'Invalid Value',
    message: 'Invalid value for this column type.',
    action: 'Try Again',
  },
  [ErrorCodes.PARSE_OUT_OF_RANGE]: {
    title: 'Value Out of Range',
    message: 'Value is out of allowed range.',
    action: 'Try Again',
  },
  [ErrorCodes.PARSE_TIMEOUT]: {
    title: 'Parsing Timeout',
    message: 'Parsing took too long. Please try again.',
    action: 'Try Again',
  },

  // Network errors
  [ErrorCodes.NET_OFFLINE]: {
    title: 'No Connection',
    message: 'No internet connection. Your changes will be saved locally and synced when you reconnect.',
    action: 'Try Again',
  },
  [ErrorCodes.NET_TIMEOUT]: {
    title: 'Request Timeout',
    message: 'Request timed out. Please check your connection and try again.',
    action: 'Try Again',
  },
  [ErrorCodes.NET_SERVER_ERROR]: {
    title: 'Server Error',
    message: 'Server error. Please try again in a moment.',
    action: 'Try Again',
  },
  [ErrorCodes.NET_NOT_FOUND]: {
    title: 'Not Found',
    message: 'The requested resource was not found.',
  },

  // Database errors
  [ErrorCodes.DB_CONNECTION_FAILED]: {
    title: 'Database Error',
    message: 'Database connection failed. Please try again in a moment.',
    action: 'Try Again',
  },
  [ErrorCodes.DB_QUERY_FAILED]: {
    title: 'Database Error',
    message: 'Database operation failed. Please try again.',
    action: 'Try Again',
  },
  [ErrorCodes.DB_CONSTRAINT_VIOLATION]: {
    title: 'Constraint Violation',
    message: 'This operation violates a database constraint.',
  },
  [ErrorCodes.DB_CONFLICT]: {
    title: 'Conflict Detected',
    message: 'This record was modified by another user. Please refresh and try again.',
    action: 'Refresh',
  },

  // Authentication errors
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: {
    title: 'Invalid Credentials',
    message: 'Invalid username or password.',
    action: 'Try Again',
  },
  [ErrorCodes.AUTH_SESSION_EXPIRED]: {
    title: 'Session Expired',
    message: 'Your session has expired. Please log in again.',
    action: 'Log In',
  },
  [ErrorCodes.AUTH_UNAUTHORIZED]: {
    title: 'Unauthorized',
    message: 'You do not have permission to perform this action.',
  },

  // Validation errors
  [ErrorCodes.VAL_REQUIRED_FIELD]: {
    title: 'Required Field',
    message: 'This field is required.',
    action: 'Try Again',
  },
  [ErrorCodes.VAL_INVALID_FORMAT]: {
    title: 'Invalid Format',
    message: 'Invalid format. Please check your input.',
    action: 'Try Again',
  },
  [ErrorCodes.VAL_OUT_OF_RANGE]: {
    title: 'Out of Range',
    message: 'Value is out of allowed range.',
    action: 'Try Again',
  },
  [ErrorCodes.VAL_DUPLICATE]: {
    title: 'Duplicate Value',
    message: 'This value already exists.',
    action: 'Try Again',
  },

  // Generic errors
  [ErrorCodes.NO_CELL_SELECTED]: {
    title: 'No Cell Selected',
    message: 'No cell selected. Click a cell before recording.',
    action: 'Try Again',
  },
  [ErrorCodes.UNKNOWN]: {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred. Please try again.',
    action: 'Try Again',
  },
};

/**
 * Get user-friendly error message for a given error code
 */
export function getErrorMessage(code: string): ErrorMapping {
  return ErrorMessages[code] || {
    title: 'Error',
    message: 'An error occurred. Please try again.',
    action: 'Try Again',
  };
}
