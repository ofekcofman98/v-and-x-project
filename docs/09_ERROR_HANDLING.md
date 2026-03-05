# VocalGrid - Error Handling

**Chapter:** 09  
**Dependencies:** 05_VOICE_PIPELINE.md, 07_MATCHING_ENGINE.md  
**Related:** 08_UI_COMPONENTS.md, 11_API_ROUTES.md

---

## Table of Contents

1. [Error Handling Philosophy](#1-error-handling-philosophy)
   - 1.1 [Principles](#11-principles)
   - 1.2 [Error Categories](#12-error-categories)

2. [Error Types & Definitions](#2-error-types--definitions)
   - 2.1 [Custom Error Classes](#21-custom-error-classes)
   - 2.2 [Error Codes](#22-error-codes)

3. [Client-Side Error Handling](#3-client-side-error-handling)
   - 3.1 [Recording Errors](#31-recording-errors)
   - 3.2 [Network Errors](#32-network-errors)
   - 3.3 [Validation Errors](#33-validation-errors)

4. [Server-Side Error Handling](#4-server-side-error-handling)
   - 4.1 [API Route Error Handling](#41-api-route-error-handling)
   - 4.2 [Database Error Handling](#42-database-error-handling)
   - 4.3 [External API Errors](#43-external-api-errors)

5. [Error Recovery Strategies](#5-error-recovery-strategies)
   - 5.1 [Automatic Retry](#51-automatic-retry)
   - 5.2 [Graceful Degradation](#52-graceful-degradation)
   - 5.3 [User-Initiated Recovery](#53-user-initiated-recovery)

6. [Error Reporting & Logging](#6-error-reporting--logging)
   - 6.1 [Client-Side Logging](#61-client-side-logging)
   - 6.2 [Server-Side Logging](#62-server-side-logging)
   - 6.3 [Error Aggregation](#63-error-aggregation)

7. [User Communication](#7-user-communication)
   - 7.1 [Error Messages](#71-error-messages)
   - 7.2 [Toast Notifications](#72-toast-notifications)
   - 7.3 [Error Dialogs](#73-error-dialogs)

8. [Edge Cases & Special Scenarios](#8-edge-cases--special-scenarios)
   - 8.1 [Offline Mode](#81-offline-mode)
   - 8.2 [Concurrent Updates](#82-concurrent-updates)
   - 8.3 [Rate Limiting](#83-rate-limiting)

9. [Testing Error Scenarios](#9-testing-error-scenarios)
   - 9.1 [Unit Tests](#91-unit-tests)
   - 9.2 [Integration Tests](#92-integration-tests)
   - 9.3 [Chaos Testing](#93-chaos-testing)

10. [Error Handling Checklist](#10-error-handling-checklist)

---

## 1. Error Handling Philosophy

### 1.1 Principles

**User-First Approach:**
- Errors should never expose technical details to users
- Every error should have a clear, actionable message
- Users should always know what happened and what to do next

**Progressive Enhancement:**
- Graceful degradation when features fail
- Core functionality should work even if advanced features fail
- Never block the user completely

**Transparency:**
- Log all errors for debugging
- Track error metrics for monitoring
- Be honest with users about what went wrong

**Recovery-Oriented:**
- Provide clear recovery paths
- Automatic retry when appropriate
- Manual retry always available

### 1.2 Error Categories
```typescript
// types/errors.ts

export enum ErrorSeverity {
  INFO = 'info',           // Informational, no action needed
  WARNING = 'warning',     // Something unexpected, but handled
  ERROR = 'error',         // Operation failed, user action needed
  CRITICAL = 'critical',   // System failure, immediate attention
}

export enum ErrorCategory {
  RECORDING = 'recording',         // Audio capture issues
  NETWORK = 'network',             // Connectivity issues
  VALIDATION = 'validation',       // Data validation failures
  AUTHENTICATION = 'authentication', // Auth failures
  AUTHORIZATION = 'authorization',   // Permission issues
  EXTERNAL_API = 'external_api',   // Third-party API failures
  DATABASE = 'database',           // Database errors
  PARSING = 'parsing',             // Voice parsing errors
  MATCHING = 'matching',           // Entity matching errors
  UNKNOWN = 'unknown',             // Unexpected errors
}
```

---

## 2. Error Types & Definitions

### 2.1 Custom Error Classes
```typescript
// lib/errors/VocalGridError.ts

export interface ErrorContext {
  [key: string]: any;
}

export class VocalGridError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly recoverable: boolean;
  public readonly userMessage: string;
  public readonly context?: ErrorContext;
  public readonly timestamp: Date;

  constructor(
    code: string,
    message: string,
    options: {
      severity: ErrorSeverity;
      category: ErrorCategory;
      recoverable: boolean;
      userMessage: string;
      context?: ErrorContext;
    }
  ) {
    super(message);
    this.name = 'VocalGridError';
    this.code = code;
    this.severity = options.severity;
    this.category = options.category;
    this.recoverable = options.recoverable;
    this.userMessage = options.userMessage;
    this.context = options.context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown (V8 only)
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
      recoverable: this.recoverable,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}
```

### 2.2 Error Codes
```typescript
// lib/errors/error-codes.ts

export const ErrorCodes = {
  // Recording errors (REC_xxx)
  REC_PERMISSION_DENIED: 'REC_PERMISSION_DENIED',
  REC_NO_MICROPHONE: 'REC_NO_MICROPHONE',
  REC_DEVICE_BUSY: 'REC_DEVICE_BUSY',
  REC_FAILED: 'REC_FAILED',
  REC_TOO_SHORT: 'REC_TOO_SHORT',
  REC_TOO_LONG: 'REC_TOO_LONG',

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

  // Unknown
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

---

## 3. Client-Side Error Handling

### 3.1 Recording Errors
```typescript
// lib/errors/recording-errors.ts

import { VocalGridError, ErrorSeverity, ErrorCategory } from './VocalGridError';
import { ErrorCodes } from './error-codes';

export class RecordingError extends VocalGridError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    const config = getRecordingErrorConfig(code);
    super(code, message, {
      severity: config.severity,
      category: ErrorCategory.RECORDING,
      recoverable: config.recoverable,
      userMessage: config.userMessage,
      context,
    });
  }
}

function getRecordingErrorConfig(code: ErrorCode) {
  const configs: Record<string, any> = {
    [ErrorCodes.REC_PERMISSION_DENIED]: {
      severity: ErrorSeverity.ERROR,
      recoverable: false,
      userMessage: 'Microphone access denied. Please enable microphone permissions in your browser settings.',
    },
    [ErrorCodes.REC_NO_MICROPHONE]: {
      severity: ErrorSeverity.ERROR,
      recoverable: false,
      userMessage: 'No microphone detected. Please connect a microphone and try again.',
    },
    [ErrorCodes.REC_DEVICE_BUSY]: {
      severity: ErrorSeverity.WARNING,
      recoverable: true,
      userMessage: 'Microphone is being used by another application. Please close other apps and try again.',
    },
    [ErrorCodes.REC_FAILED]: {
      severity: ErrorSeverity.ERROR,
      recoverable: true,
      userMessage: 'Failed to record audio. Please try again.',
    },
    [ErrorCodes.REC_TOO_SHORT]: {
      severity: ErrorSeverity.WARNING,
      recoverable: true,
      userMessage: 'Recording too short. Please speak for at least 1 second.',
    },
    [ErrorCodes.REC_TOO_LONG]: {
      severity: ErrorSeverity.WARNING,
      recoverable: true,
      userMessage: 'Recording too long. Please keep recordings under 60 seconds.',
    },
  };

  return configs[code] || {
    severity: ErrorSeverity.ERROR,
    recoverable: true,
    userMessage: 'An error occurred while recording. Please try again.',
  };
}

// Usage:
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
} catch (error: any) {
  if (error.name === 'NotAllowedError') {
    throw new RecordingError(
      ErrorCodes.REC_PERMISSION_DENIED,
      'Microphone permission denied',
      { originalError: error }
    );
  } else if (error.name === 'NotFoundError') {
    throw new RecordingError(
      ErrorCodes.REC_NO_MICROPHONE,
      'No microphone found',
      { originalError: error }
    );
  } else {
    throw new RecordingError(
      ErrorCodes.REC_FAILED,
      'Recording failed',
      { originalError: error }
    );
  }
}
```

### 3.2 Network Errors
```typescript
// lib/errors/network-errors.ts

export class NetworkError extends VocalGridError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    const config = getNetworkErrorConfig(code);
    super(code, message, {
      severity: config.severity,
      category: ErrorCategory.NETWORK,
      recoverable: config.recoverable,
      userMessage: config.userMessage,
      context,
    });
  }
}

function getNetworkErrorConfig(code: ErrorCode) {
  const configs: Record<string, any> = {
    [ErrorCodes.NET_OFFLINE]: {
      severity: ErrorSeverity.WARNING,
      recoverable: true,
      userMessage: 'No internet connection. Your changes will be saved locally and synced when you reconnect.',
    },
    [ErrorCodes.NET_TIMEOUT]: {
      severity: ErrorSeverity.WARNING,
      recoverable: true,
      userMessage: 'Request timed out. Please check your connection and try again.',
    },
    [ErrorCodes.NET_SERVER_ERROR]: {
      severity: ErrorSeverity.ERROR,
      recoverable: true,
      userMessage: 'Server error. Please try again in a moment.',
    },
    [ErrorCodes.NET_NOT_FOUND]: {
      severity: ErrorSeverity.ERROR,
      recoverable: false,
      userMessage: 'The requested resource was not found.',
    },
  };

  return configs[code] || {
    severity: ErrorSeverity.ERROR,
    recoverable: true,
    userMessage: 'Network error. Please check your connection and try again.',
  };
}

// HTTP Error Handler
export function handleHttpError(response: Response): never {
  const statusCodeMap: Record<number, ErrorCode> = {
    404: ErrorCodes.NET_NOT_FOUND,
    408: ErrorCodes.NET_TIMEOUT,
    429: ErrorCodes.STT_RATE_LIMIT,
    500: ErrorCodes.NET_SERVER_ERROR,
    502: ErrorCodes.NET_SERVER_ERROR,
    503: ErrorCodes.NET_SERVER_ERROR,
    504: ErrorCodes.NET_TIMEOUT,
  };

  const code = statusCodeMap[response.status] || ErrorCodes.UNKNOWN;

  throw new NetworkError(
    code,
    `HTTP ${response.status}: ${response.statusText}`,
    { status: response.status, statusText: response.statusText }
  );
}

// Fetch Wrapper with Error Handling
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      handleHttpError(response);
    }

    return response;
  } catch (error: any) {
    if (error instanceof VocalGridError) {
      throw error;
    }

    // Network failure (offline, CORS, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new NetworkError(
        ErrorCodes.NET_OFFLINE,
        'Network request failed',
        { originalError: error, url }
      );
    }

    throw new NetworkError(
      ErrorCodes.UNKNOWN,
      'Unknown network error',
      { originalError: error, url }
    );
  }
}
```

### 3.3 Validation Errors
```typescript
// lib/errors/validation-errors.ts

export class ValidationError extends VocalGridError {
  public readonly field?: string;

  constructor(
    code: ErrorCode,
    message: string,
    field?: string,
    context?: ErrorContext
  ) {
    const config = getValidationErrorConfig(code);
    super(code, message, {
      severity: ErrorSeverity.WARNING,
      category: ErrorCategory.VALIDATION,
      recoverable: true,
      userMessage: config.userMessage,
      context,
    });
    this.field = field;
  }
}

function getValidationErrorConfig(code: ErrorCode) {
  const configs: Record<string, any> = {
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

// Value Validator
export function validateCellValue(
  value: any,
  columnType: string,
  validation?: any
): void {
  if (value === null || value === undefined) {
    if (validation?.required) {
      throw new ValidationError(
        ErrorCodes.VAL_REQUIRED_FIELD,
        'Value is required',
        columnType
      );
    }
    return;
  }

  switch (columnType) {
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(
          ErrorCodes.VAL_INVALID_FORMAT,
          'Must be a number',
          columnType
        );
      }
      if (validation?.min !== undefined && value < validation.min) {
        throw new ValidationError(
          ErrorCodes.VAL_OUT_OF_RANGE,
          `Must be at least ${validation.min}`,
          columnType,
          { min: validation.min, value }
        );
      }
      if (validation?.max !== undefined && value > validation.max) {
        throw new ValidationError(
          ErrorCodes.VAL_OUT_OF_RANGE,
          `Must be at most ${validation.max}`,
          columnType,
          { max: validation.max, value }
        );
      }
      break;

    case 'text':
      if (typeof value !== 'string') {
        throw new ValidationError(
          ErrorCodes.VAL_INVALID_FORMAT,
          'Must be text',
          columnType
        );
      }
      if (validation?.minLength && value.length < validation.minLength) {
        throw new ValidationError(
          ErrorCodes.VAL_OUT_OF_RANGE,
          `Must be at least ${validation.minLength} characters`,
          columnType
        );
      }
      if (validation?.maxLength && value.length > validation.maxLength) {
        throw new ValidationError(
          ErrorCodes.VAL_OUT_OF_RANGE,
          `Must be at most ${validation.maxLength} characters`,
          columnType
        );
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new ValidationError(
          ErrorCodes.VAL_INVALID_FORMAT,
          'Must be true or false',
          columnType
        );
      }
      break;
  }
}
```

---

## 4. Server-Side Error Handling

### 4.1 API Route Error Handling
```typescript
// lib/errors/api-error-handler.ts

import { NextResponse } from 'next/server';
import { VocalGridError } from './VocalGridError';
import { logger } from '@/lib/logger';

export function handleApiError(error: unknown): NextResponse {
  // Handle known VocalGridError
  if (error instanceof VocalGridError) {
    logger.error('API Error', {
      code: error.code,
      message: error.message,
      category: error.category,
      severity: error.severity,
      context: error.context,
    });

    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.userMessage,
          recoverable: error.recoverable,
        },
      },
      { status: getHttpStatusFromError(error) }
    );
  }

  // Handle unknown errors
  logger.error('Unknown API Error', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return NextResponse.json(
    {
      error: {
        code: 'UNKNOWN',
        message: 'An unexpected error occurred. Please try again.',
        recoverable: true,
      },
    },
    { status: 500 }
  );
}

function getHttpStatusFromError(error: VocalGridError): number {
  const statusMap: Record<string, number> = {
    [ErrorCategory.AUTHENTICATION]: 401,
    [ErrorCategory.AUTHORIZATION]: 403,
    [ErrorCategory.VALIDATION]: 400,
    [ErrorCategory.NETWORK]: 503,
    [ErrorCategory.EXTERNAL_API]: 502,
  };

  return statusMap[error.category] || 500;
}

// Usage in API routes:
export async function POST(req: NextRequest) {
  try {
    // Your logic here
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### 4.2 Database Error Handling
```typescript
// lib/errors/database-errors.ts

import { PostgrestError } from '@supabase/supabase-js';

export class DatabaseError extends VocalGridError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    const config = getDatabaseErrorConfig(code);
    super(code, message, {
      severity: config.severity,
      category: ErrorCategory.DATABASE,
      recoverable: config.recoverable,
      userMessage: config.userMessage,
      context,
    });
  }
}

function getDatabaseErrorConfig(code: ErrorCode) {
  const configs: Record<string, any> = {
    [ErrorCodes.DB_CONNECTION_FAILED]: {
      severity: ErrorSeverity.CRITICAL,
      recoverable: true,
      userMessage: 'Database connection failed. Please try again in a moment.',
    },
    [ErrorCodes.DB_QUERY_FAILED]: {
      severity: ErrorSeverity.ERROR,
      recoverable: true,
      userMessage: 'Database operation failed. Please try again.',
    },
    [ErrorCodes.DB_CONSTRAINT_VIOLATION]: {
      severity: ErrorSeverity.WARNING,
      recoverable: false,
      userMessage: 'This operation violates a database constraint.',
    },
    [ErrorCodes.DB_CONFLICT]: {
      severity: ErrorSeverity.WARNING,
      recoverable: true,
      userMessage: 'This record was modified by another user. Please refresh and try again.',
    },
  };

  return configs[code] || {
    severity: ErrorSeverity.ERROR,
    recoverable: true,
    userMessage: 'A database error occurred. Please try again.',
  };
}

// Handle Supabase Errors
export function handleSupabaseError(error: PostgrestError): never {
  // Unique constraint violation
  if (error.code === '23505') {
    throw new DatabaseError(
      ErrorCodes.DB_CONSTRAINT_VIOLATION,
      'Unique constraint violation',
      { originalError: error }
    );
  }

  // Foreign key violation
  if (error.code === '23503') {
    throw new DatabaseError(
      ErrorCodes.DB_CONSTRAINT_VIOLATION,
      'Foreign key constraint violation',
      { originalError: error }
    );
  }

  // Generic database error
  throw new DatabaseError(
    ErrorCodes.DB_QUERY_FAILED,
    error.message,
    { originalError: error }
  );
}
```

### 4.3 External API Errors
```typescript
// lib/errors/external-api-errors.ts

export class ExternalApiError extends VocalGridError {
  public readonly apiName: string;

  constructor(
    apiName: string,
    code: ErrorCode,
    message: string,
    context?: ErrorContext
  ) {
    const config = getExternalApiErrorConfig(code);
    super(code, message, {
      severity: config.severity,
      category: ErrorCategory.EXTERNAL_API,
      recoverable: config.recoverable,
      userMessage: config.userMessage,
      context,
    });
    this.apiName = apiName;
  }
}

function getExternalApiErrorConfig(code: ErrorCode) {
  const configs: Record<string, any> = {
    [ErrorCodes.STT_TIMEOUT]: {
      severity: ErrorSeverity.WARNING,
      recoverable: true,
      userMessage: 'Speech recognition timed out. Please try again.',
    },
    [ErrorCodes.STT_NO_SPEECH]: {
      severity: ErrorSeverity.INFO,
      recoverable: true,
      userMessage: 'No speech detected. Please speak clearly into the microphone.',
    },
    [ErrorCodes.STT_RATE_LIMIT]: {
      severity: ErrorSeverity.WARNING,
      recoverable: true,
      userMessage: 'Too many requests. Please wait a moment and try again.',
    },
    [ErrorCodes.STT_API_ERROR]: {
      severity: ErrorSeverity.ERROR,
      recoverable: true,
      userMessage: 'Speech recognition service error. Please try again.',
    },
  };

  return configs[code] || {
    severity: ErrorSeverity.ERROR,
    recoverable: true,
    userMessage: 'External service error. Please try again.',
  };
}

// Handle OpenAI API Errors
export function handleOpenAIError(error: any, apiName: string): never {
  if (error.status === 429) {
    throw new ExternalApiError(
      apiName,
      ErrorCodes.STT_RATE_LIMIT,
      'Rate limit exceeded',
      { originalError: error }
    );
  }

  if (error.status === 408 || error.code === 'ETIMEDOUT') {
    throw new ExternalApiError(
      apiName,
      ErrorCodes.STT_TIMEOUT,
      'API request timed out',
      { originalError: error }
    );
  }

  throw new ExternalApiError(
    apiName,
    ErrorCodes.STT_API_ERROR,
    error.message || 'API error',
    { originalError: error }
  );
}
```

---

## 5. Error Recovery Strategies

### 5.1 Automatic Retry
```typescript
// lib/retry/retry-strategy.ts

interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCode[];
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorCodes.NET_TIMEOUT,
    ErrorCodes.NET_SERVER_ERROR,
    ErrorCodes.STT_TIMEOUT,
    ErrorCodes.STT_API_ERROR,
  ],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const mergedConfig = { ...defaultRetryConfig, ...config };
  let lastError: Error;
  let delay = mergedConfig.initialDelay;

  for (let attempt = 1; attempt <= mergedConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const isRetryable =
        error instanceof VocalGridError &&
        mergedConfig.retryableErrors.includes(error.code);

      // Last attempt or not retryable
      if (attempt === mergedConfig.maxAttempts || !isRetryable) {
        throw error;
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * mergedConfig.backoffMultiplier, mergedConfig.maxDelay);

      console.log(`Retrying (attempt ${attempt + 1}/${mergedConfig.maxAttempts})...`);
    }
  }

  throw lastError!;
}

// Usage:
const result = await withRetry(
  async () => {
    const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
    return response.json();
  },
  {
    maxAttempts: 3,
    initialDelay: 1000,
  }
);
```

### 5.2 Graceful Degradation
```typescript
// lib/graceful-degradation/fallback-strategy.ts

export class FallbackStrategy {
  // Try voice input, fallback to manual if fails
  static async tryVoiceWithManualFallback(
    voiceFn: () => Promise<any>,
    manualFn: () => Promise<any>
  ): Promise<{ result: any; method: 'voice' | 'manual' }> {
    try {
      const result = await voiceFn();
      return { result, method: 'voice' };
    } catch (error) {
      if (error instanceof VocalGridError && !error.recoverable) {
        // If voice permanently unavailable, use manual
        console.warn('Voice input unavailable, using manual fallback');
        const result = await manualFn();
        return { result, method: 'manual' };
      }
      throw error;
    }
  }

  // Try LLM matching, fallback to fuzzy matching if fails
  static async tryLLMWithFuzzyFallback(
    llmFn: () => Promise<MatchResult>,
    fuzzyFn: () => Promise<MatchResult>
  ): Promise<MatchResult> {
    try {
      return await llmFn();
    } catch (error) {
      console.warn('LLM matching failed, using fuzzy fallback');
      return await fuzzyFn();
    }
  }
}

// Usage:
const { result, method } = await FallbackStrategy.tryVoiceWithManualFallback(
  async () => handleVoiceInput(),
  async () => showManualInputDialog()
);

if (method === 'manual') {
  toast.info('Voice input unavailable. Using manual input instead.');
}
```

### 5.3 User-Initiated Recovery
```typescript
// components/ErrorRecovery.tsx

'use client';

import { useState } from 'react';
import { VocalGridError } from '@/lib/errors/VocalGridError';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface ErrorRecoveryProps {
  error: VocalGridError;
  onRetry: () => void;
  onCancel: () => void;
}

export function ErrorRecovery({ error, onRetry, onCancel }: ErrorRecoveryProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-red-900">
            {error.userMessage}
          </p>
          
          {error.recoverable && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={retrying}
              >
                {retrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </>
                )}
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancel}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Error Reporting & Logging

### 6.1 Client-Side Logging
```typescript
// lib/logging/client-logger.ts

export class ClientLogger {
  private static instance: ClientLogger;

  static getInstance(): ClientLogger {
    if (!ClientLogger.instance) {
      ClientLogger.instance = new ClientLogger();
    }
    return ClientLogger.instance;
  }

  error(error: VocalGridError | Error, context?: any) {
    const errorData = error instanceof VocalGridError ? error.toJSON() : {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    // Log to console (development)
    if (process.env.NODE_ENV === 'development') {
      console.error('[Error]', errorData, context);
    }

    // Send to analytics (production)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Google Analytics
      (window as any).gtag?.('event', 'exception', {
        description: errorData.message,
        fatal: error instanceof VocalGridError && error.severity === 'critical',
      });

      // Or send to your error tracking service (Sentry, etc.)
      // Sentry.captureException(error);
    }

    // Store in local error log (for debugging)
    this.storeErrorLocally(errorData, context);
  }

  warn(message: string, context?: any) {
    console.warn('[Warning]', message, context);
  }

  info(message: string, context?: any) {
    console.log('[Info]', message, context);
  }

  private storeErrorLocally(error: any, context?: any) {
    try {
      const errors = JSON.parse(localStorage.getItem('vocalgrid_errors') || '[]');
      errors.push({
        ...error,
        context,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.shift();
      }

      localStorage.setItem('vocalgrid_errors', JSON.stringify(errors));
    } catch (e) {
      // Ignore localStorage errors
    }
  }
}

export const logger = ClientLogger.getInstance();
```

### 6.2 Server-Side Logging
```typescript
// lib/logging/server-logger.ts

import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'vocalgrid-api' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // Error logs to file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),

    // All logs to file
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

export { logger };

// Usage in API routes:
import { logger } from '@/lib/logging/server-logger';

logger.error('Transcription failed', {
  userId: 'user123',
  audioSize: audioBlob.size,
  error: error.message,
});
```

### 6.3 Error Aggregation
```typescript
// lib/monitoring/error-aggregator.ts

interface ErrorMetrics {
  total: number;
  byCode: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

export class ErrorAggregator {
  private static instance: ErrorAggregator;
  private metrics: ErrorMetrics = {
    total: 0,
    byCode: {},
    byCategory: {},
    bySeverity: {},
  };

  static getInstance(): ErrorAggregator {
    if (!ErrorAggregator.instance) {
      ErrorAggregator.instance = new ErrorAggregator();
    }
    return ErrorAggregator.instance;
  }

  track(error: VocalGridError) {
    this.metrics.total++;
    this.metrics.byCode[error.code] = (this.metrics.byCode[error.code] || 0) + 1;
    this.metrics.byCategory[error.category] = (this.metrics.byCategory[error.category] || 0) + 1;
    this.metrics.bySeverity[error.severity] = (this.metrics.bySeverity[error.severity] || 0) + 1;
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      total: 0,
      byCode: {},
      byCategory: {},
      bySeverity: {},
    };
  }
}

export const errorAggregator = ErrorAggregator.getInstance();
```

---

## 7. User Communication

### 7.1 Error Messages
```typescript
// lib/messages/error-messages.ts

export const ErrorMessages = {
  // Friendly, actionable messages
  friendly: {
    [ErrorCodes.REC_PERMISSION_DENIED]: {
      title: 'Microphone Access Needed',
      message: 'To use voice input, please allow microphone access in your browser settings.',
      action: 'Open Settings',
    },
    [ErrorCodes.STT_NO_SPEECH]: {
      title: 'No Speech Detected',
      message: 'We couldn\'t hear you. Try speaking a bit louder or closer to the microphone.',
      action: 'Try Again',
    },
    [ErrorCodes.PARSE_NO_MATCH]: {
      title: 'Name Not Found',
      message: 'We couldn\'t find that name in the table. Would you like to add it?',
      action: 'Add New Entry',
    },
  },

  // Technical messages (for developers)
  technical: {
    [ErrorCodes.DB_QUERY_FAILED]: 'Database query failed',
    [ErrorCodes.NET_TIMEOUT]: 'Network request timed out',
    [ErrorCodes.STT_API_ERROR]: 'Whisper API error',
  },
};
```

### 7.2 Toast Notifications
```typescript
// lib/toast/error-toast.ts

import { useToast } from '@/components/ui/use-toast';
import { VocalGridError } from '@/lib/errors/VocalGridError';

export function useErrorToast() {
  const { toast } = useToast();

  const showError = (error: VocalGridError) => {
    toast({
      title: getErrorTitle(error),
      description: error.userMessage,
      variant: getToastVariant(error.severity),
      duration: error.recoverable ? 5000 : 0, // Auto-dismiss if recoverable
    });
  };

  return { showError };
}

function getErrorTitle(error: VocalGridError): string {
  switch (error.severity) {
    case 'critical':
      return 'Critical Error';
    case 'error':
      return 'Error';
    case 'warning':
      return 'Warning';
    case 'info':
    default:
      return 'Notice';
  }
}

function getToastVariant(severity: string): 'default' | 'destructive' {
  return severity === 'critical' || severity === 'error' ? 'destructive' : 'default';
}
```

### 7.3 Error Dialogs
```typescript
// components/ErrorDialog.tsx

'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { VocalGridError } from '@/lib/errors/VocalGridError';

interface ErrorDialogProps {
  error: VocalGridError | null;
  open: boolean;
  onClose: () => void;
  onRetry?: () => void;
}

export function ErrorDialog({ error, open, onClose, onRetry }: ErrorDialogProps) {
  if (!error) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getErrorTitle(error)}</AlertDialogTitle>
          <AlertDialogDescription>
            {error.userMessage}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          {error.recoverable && onRetry && (
            <AlertDialogAction onClick={onRetry}>
              Try Again
            </AlertDialogAction>
          )}
          <AlertDialogCancel onClick={onClose}>
            {error.recoverable ? 'Cancel' : 'Close'}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function getErrorTitle(error: VocalGridError): string {
  switch (error.category) {
    case 'recording':
      return 'Recording Error';
    case 'network':
      return 'Connection Error';
    case 'validation':
      return 'Validation Error';
    case 'authentication':
      return 'Authentication Error';
    default:
      return 'Error';
  }
}
```

---

## 8. Edge Cases & Special Scenarios

### 8.1 Offline Mode
```typescript
// lib/offline/offline-handler.ts

export class OfflineHandler {
  private queue: Array<() => Promise<any>> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flush());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!navigator.onLine) {
      return new Promise((resolve, reject) => {
        this.queue.push(async () => {
          try {
            const result = await fn();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });

        // Notify user
        throw new NetworkError(
          ErrorCodes.NET_OFFLINE,
          'Offline',
          { queued: true }
        );
      });
    }

    return fn();
  }

  private async flush() {
    console.log(`Processing ${this.queue.length} queued operations...`);

    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      try {
        await operation?.();
      } catch (error) {
        console.error('Failed to execute queued operation:', error);
      }
    }
  }

  private handleOffline() {
    console.warn('Device is offline. Operations will be queued.');
  }
}

export const offlineHandler = new OfflineHandler();
```

### 8.2 Concurrent Updates
```typescript
// lib/concurrency/conflict-resolver.ts

export class ConflictResolver {
  static resolveConflict(
    localValue: any,
    remoteValue: any,
    strategy: 'last-write-wins' | 'manual' = 'last-write-wins'
  ): any {
    if (strategy === 'last-write-wins') {
      // Remote value always wins (from database)
      return remoteValue;
    }

    // For manual strategy, throw error and let user decide
    throw new DatabaseError(
      ErrorCodes.DB_CONFLICT,
      'Concurrent modification detected',
      { localValue, remoteValue }
    );
  }

  static async handleOptimisticUpdateConflict(
    mutation: any,
    conflictData: any
  ) {
    // Show dialog asking user to choose
    // For now, just use remote value
    return conflictData.remote;
  }
}
```

### 8.3 Rate Limiting
```typescript
// lib/rate-limiting/rate-limiter.ts

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<void> {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps outside window
    const validTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < windowMs
    );

    if (validTimestamps.length >= limit) {
      throw new ExternalApiError(
        'VocalGrid',
        ErrorCodes.STT_RATE_LIMIT,
        'Rate limit exceeded',
        {
          limit,
          window: windowMs,
          resetAt: validTimestamps[0] + windowMs,
        }
      );
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
  }
}

export const rateLimiter = new RateLimiter();

// Usage:
await rateLimiter.checkLimit('voice-input-user123', 10, 60000); // 10 per minute
```

---

## 9. Testing Error Scenarios

### 9.1 Unit Tests
```typescript
// tests/errors/error-handling.test.ts

import { describe, it, expect, vi } from 'vitest';
import { RecordingError } from '@/lib/errors/recording-errors';
import { ErrorCodes } from '@/lib/errors/error-codes';

describe('Error Handling', () => {
  it('should create RecordingError with correct properties', () => {
    const error = new RecordingError(
      ErrorCodes.REC_PERMISSION_DENIED,
      'Permission denied'
    );

    expect(error.code).toBe(ErrorCodes.REC_PERMISSION_DENIED);
    expect(error.category).toBe('recording');
    expect(error.recoverable).toBe(false);
    expect(error.userMessage).toContain('Microphone access denied');
  });

  it('should serialize to JSON correctly', () => {
    const error = new RecordingError(
      ErrorCodes.REC_FAILED,
      'Recording failed',
      { deviceId: 'mic123' }
    );

    const json = error.toJSON();

    expect(json.code).toBe(ErrorCodes.REC_FAILED);
    expect(json.context).toEqual({ deviceId: 'mic123' });
    expect(json.timestamp).toBeDefined();
  });
});
```

### 9.2 Integration Tests
```typescript
// tests/integration/error-recovery.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceButton } from '@/components/VoiceButton';
import { vi } from 'vitest';

describe('Error Recovery', () => {
  it('should show retry button on recording error', async () => {
    // Mock failed getUserMedia
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
      new Error('Permission denied')
    );

    render(<VoiceButton />);

    const button = screen.getByLabelText('Start voice recording');
    await userEvent.click(button);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Microphone access denied/i)).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
});
```

### 9.3 Chaos Testing
```typescript
// tests/chaos/error-injection.ts

/**
 * Inject random errors to test error handling robustness
 */
export class ErrorInjector {
  private enabled = process.env.NODE_ENV === 'test';
  private errorRate = 0.1; // 10% error rate

  shouldInjectError(): boolean {
    return this.enabled && Math.random() < this.errorRate;
  }

  injectRandomError(): never {
    const errors = [
      new NetworkError(ErrorCodes.NET_TIMEOUT, 'Injected timeout'),
      new NetworkError(ErrorCodes.NET_SERVER_ERROR, 'Injected server error'),
      new RecordingError(ErrorCodes.REC_FAILED, 'Injected recording error'),
    ];

    const randomError = errors[Math.floor(Math.random() * errors.length)];
    throw randomError;
  }
}

// Usage in code (test environment only):
const injector = new ErrorInjector();

async function handleVoiceInput() {
  if (injector.shouldInjectError()) {
    injector.injectRandomError();
  }

  // Normal logic...
}
```

---

## 10. Error Handling Checklist

**Error Classes:**
- [ ] Custom VocalGridError base class
- [ ] Specific error classes (RecordingError, NetworkError, etc.)
- [ ] Error codes defined
- [ ] Error serialization (toJSON)

**Client-Side:**
- [ ] Recording error handling
- [ ] Network error handling
- [ ] Validation error handling
- [ ] Error logging
- [ ] Error UI (toasts, dialogs)

**Server-Side:**
- [ ] API route error handling
- [ ] Database error handling
- [ ] External API error handling
- [ ] Server logging
- [ ] Proper HTTP status codes

**Recovery:**
- [ ] Automatic retry logic
- [ ] Graceful degradation
- [ ] User-initiated retry
- [ ] Offline queue
- [ ] Conflict resolution

**Communication:**
- [ ] User-friendly error messages
- [ ] Toast notifications
- [ ] Error dialogs
- [ ] Error recovery UI

**Testing:**
- [ ] Unit tests for error classes
- [ ] Integration tests for error flows
- [ ] Chaos/error injection tests
- [ ] Error logging verified

---

*End of Error Handling Documentation*