/**
 * Parse API Route
 * HTTP transport layer only — all business logic lives in:
 *   lib/server/services/parse-service.ts
 *
 * Responsibilities of this file:
 *   - Validate the JSON request body with Zod
 *   - Resolve active column/row from the provided schema
 *   - Delegate to executeTranscriptParse
 *   - Wrap the result in the standard { success, data } envelope
 *
 * Based on: docs/05_VOICE_PIPELINE.md, docs/11_API_ROUTES.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import { executeTranscriptParse } from '@/lib/server/services/parse-service';

// export const runtime = 'nodejs';
export const runtime = 'edge';

// ─────────────────────────────────────────────────────────────────────────────
// Input validation schemas (HTTP / API layer)
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
  rows: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    })
  ),
});

const ParseRequestSchema = z.object({
  transcript: z.string().min(1),
  tableSchema: TableSchemaInput,
  activeCell: z.object({
    rowId: z.string(),
    columnId: z.string(),
  }),
  navigationMode: z.enum(['column-first', 'row-first']),
});

const ParsedResultSchema = z.object({
  entity: z.string().nullable(),
  entityMatch: z
    .object({
      original: z.string().nullable(),
      matched: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      matchType: z.enum(['exact', 'fuzzy', 'phonetic', 'semantic']).nullable(),
    })
    .nullable(),
  value: z.unknown(),
  valueValid: z.boolean(),
  action: z.enum(['UPDATE_CELL', 'ERROR', 'AMBIGUOUS']),
  error: z.string().optional(),
  alternatives: z
    .array(
      z.object({
        entity: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .optional(),
  reasoning: z.string().optional(),
  duration: z.number().optional(),
});

// Suppress unused-variable warning — ParsedResultSchema is retained here
// as part of the HTTP validation contract for documentation and future use.
void ParsedResultSchema;

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'OPENAI_KEY_MISSING', message: 'OpenAI API key is not configured.' },
      },
      { status: 500 }
    );
  }

  try {
    const rawBody: unknown = await req.json();
    const parsed = ParseRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Payload is invalid.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { transcript, activeCell, navigationMode } = parsed.data;
    const tableSchema: TableSchema = parsed.data.tableSchema;
    const activeColumn = tableSchema.columns.find((col) => col.id === activeCell.columnId);
    const activeRow = tableSchema.rows.find((row) => row.id === activeCell.rowId);

    if (!activeColumn || !activeRow) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CELL_NOT_FOUND', message: 'Active cell cannot be resolved.' },
        },
        { status: 400 }
      );
    }

    const responsePayload = await executeTranscriptParse({
      transcript,
      tableSchema,
      activeCell,
      navigationMode,
    });

    console.log('[Parse] success', {
      duration: responsePayload.duration,
      transcript,
      result: responsePayload,
    });

    return NextResponse.json({ success: true, data: responsePayload });
  } catch (error) {
    console.error('[Parse API]', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PARSE_FAILED',
          message: 'We could not interpret that voice command right now.',
        },
      },
      { status: 500 }
    );
  }
}
