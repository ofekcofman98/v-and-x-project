/**
 * Unified Voice Entry API Route
 * HTTP transport layer only — all business logic lives in:
 *   lib/server/services/voice-entry-service.ts
 *
 * Responsibilities of this file:
 *   - Parse and validate the multipart/form-data request
 *   - Enforce per-user rate limiting
 *   - Translate VocalGridError codes → HTTP status codes
 *   - Wrap the service result in the standard { success, data } envelope
 *
 * Based on: docs/05_VOICE_PIPELINE.md, docs/11_API_ROUTES.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type {
  VoiceEntryPayload,
  VoiceEntryResponse,
} from '@/lib/shared/types/voice-pipeline';
import { VocalGridError, ErrorCodes } from '@/lib/shared/types/voice-errors';
import { processVoiceEntry } from '@/lib/server/services/voice-entry-service';

export const runtime = 'edge';

// ─────────────────────────────────────────────────────────────────────────────
// Input validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const ColumnSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.nativeEnum(ColumnType),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
      required: z.boolean().optional(),
    })
    .optional(),
});

const TableSchemaInput = z.object({
  columns: z.array(ColumnSchema),
  rows: z.array(z.object({ id: z.string(), label: z.string() })),
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting (per-user, 10 req / min)
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;

  entry.count++;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error code → HTTP status mapping
// ─────────────────────────────────────────────────────────────────────────────

const ERROR_STATUS_MAP: Partial<Record<string, number>> = {
  [ErrorCodes.STT_RATE_LIMIT]: 429,
  [ErrorCodes.STT_INVALID_AUDIO]: 400,
  [ErrorCodes.NO_CELL_SELECTED]: 400,
  [ErrorCodes.VAL_REQUIRED_FIELD]: 400,
  [ErrorCodes.VAL_INVALID_FORMAT]: 400,
} as const;

function statusForError(code: string): number {
  return ERROR_STATUS_MAP[code] ?? 500;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<VoiceEntryResponse>> {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'OPENAI_KEY_MISSING',
          message: 'OpenAI API key is not configured.',
          details: null,
        },
      },
      { status: 500 }
    );
  }

  const userId = req.headers.get('x-user-id') ?? 'anonymous';

  if (!checkRateLimit(userId)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.STT_RATE_LIMIT,
          message: 'Too many requests. Please wait a moment and try again.',
          details: null,
        },
      },
      { status: 429 }
    );
  }

  // ── Parse form data ────────────────────────────────────────────────────────
  const formData = await req.formData();
  const audioFile = formData.get('audio') as File | null;
  const tableSchemaJson = formData.get('tableSchema') as string | null;
  const activeCellJson = formData.get('activeCell') as string | null;
  const navigationMode = (formData.get('navigationMode') as string) || 'column-first';
  const tableId = (formData.get('tableId') as string) || 'default';
  const language = req.headers.get('x-language') ?? undefined;

  // ── Input validation ───────────────────────────────────────────────────────
  if (!audioFile) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'REC_FAILED', message: 'No audio file provided', details: null },
      },
      { status: 400 }
    );
  }

  if (audioFile.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'REC_TOO_LONG', message: 'Audio file too large (max 25 MB)', details: null },
      },
      { status: 400 }
    );
  }

  if (!tableSchemaJson || !activeCellJson) {
    console.error('[VoiceEntry] Missing parameters:', {
      hasTableSchema: !!tableSchemaJson,
      hasActiveCell: !!activeCellJson,
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VAL_REQUIRED_FIELD,
          message: 'Missing required parameters (tableSchema or activeCell)',
          details: null,
        },
      },
      { status: 400 }
    );
  }

  let tableSchema: TableSchema;
  let activeCell: { rowKey: string; tableColumnId: string };

  try {
    tableSchema = TableSchemaInput.parse(JSON.parse(tableSchemaJson));
    activeCell = JSON.parse(activeCellJson) as { rowKey: string; tableColumnId: string };
    console.log('[VoiceEntry] Parsed activeCell:', activeCell);
  } catch (err) {
    console.error('[VoiceEntry] Parse error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VAL_INVALID_FORMAT,
          message: 'Invalid tableSchema or activeCell format',
          details: err,
        },
      },
      { status: 400 }
    );
  }

  // ── Delegate to service ────────────────────────────────────────────────────
  const payload: VoiceEntryPayload = {
    tableSchema,
    activeCell,
    navigationMode: navigationMode as 'column-first' | 'row-first',
    tableId,
    language,
  };

  try {
    const result = await processVoiceEntry(payload, audioFile);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof VocalGridError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.userMessage,
            details: err.context ?? null,
          },
        },
        { status: statusForError(err.code) }
      );
    }

    console.error('[VoiceEntry] Unexpected error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.NET_SERVER_ERROR,
          message: 'Failed to process voice entry. Please try again.',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS preflight
// ─────────────────────────────────────────────────────────────────────────────

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-language',
    },
  });
}
