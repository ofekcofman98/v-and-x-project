/**
 * Client-Side Logger
 * Based on: docs/09_ERROR_HANDLING.md §6.1
 */

import { VocalGridError } from '@/lib/shared/types/voice-errors';

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

    if (process.env.NODE_ENV === 'development') {
      console.error('[Error]', errorData, context);
    }

    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      (window as any).gtag?.('event', 'exception', {
        description: errorData.message,
        fatal: error instanceof VocalGridError && error.severity === 'critical',
      });
    }

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
