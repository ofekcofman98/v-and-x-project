# VocalGrid - API Routes

**Chapter:** 11  
**Dependencies:** 02_ARCHITECTURE.md, 03_DATABASE.md, 05_VOICE_PIPELINE.md  
**Related:** 07_MATCHING_ENGINE.md, 09_ERROR_HANDLING.md

---

## Table of Contents

1. [API Design Principles](#1-api-design-principles)
   - 1.1 [REST Conventions](#11-rest-conventions)
   - 1.2 [Request / Response Shape](#12-request--response-shape)
   - 1.3 [Authentication Strategy](#13-authentication-strategy)

2. [Voice Pipeline Routes](#2-voice-pipeline-routes)
   - 2.1 [POST /api/transcribe](#21-post-apitranscribe)
   - 2.2 [POST /api/parse](#22-post-apiparse)

3. [Table Routes](#3-table-routes)
   - 3.1 [GET /api/tables](#31-get-apitables)
   - 3.2 [POST /api/tables](#32-post-apitables)
   - 3.3 [GET /api/tables/[id]](#33-get-apitablesid)
   - 3.4 [PATCH /api/tables/[id]](#34-patch-apitablesid)
   - 3.5 [DELETE /api/tables/[id]](#35-delete-apitablesid)

4. [Table Data Routes](#4-table-data-routes)
   - 4.1 [GET /api/tables/[id]/data](#41-get-apitablesiddata)
   - 4.2 [PUT /api/tables/[id]/data/cell](#42-put-apitablesiddatacell)
   - 4.3 [DELETE /api/tables/[id]/data/row](#43-delete-apitablesiddatarow)

5. [Export Routes](#5-export-routes)
   - 5.1 [GET /api/tables/[id]/export/csv](#51-get-apitablesidexportcsv)
   - 5.2 [GET /api/tables/[id]/export/xlsx](#52-get-apitablesidexportxlsx)

6. [Shared Utilities](#6-shared-utilities)
   - 6.1 [Auth Helper](#61-auth-helper)
   - 6.2 [Error Response Helper](#62-error-response-helper)
   - 6.3 [Validation Helper](#63-validation-helper)

7. [Route Summary Table](#7-route-summary-table)

---

## 1. API Design Principles

### 1.1 REST Conventions

```
METHOD   PATH                                PURPOSE
────────────────────────────────────────────────────────────────
POST     /api/transcribe                     Upload audio → transcript
POST     /api/parse                          Transcript → structured data
GET      /api/tables                         List all user tables
POST     /api/tables                         Create a new table
GET      /api/tables/:id                     Get single table + schema
PATCH    /api/tables/:id                     Update table meta / schema
DELETE   /api/tables/:id                     Delete table + all data
GET      /api/tables/:id/data               Get all cell values
PUT      /api/tables/:id/data/cell          Upsert single cell
DELETE   /api/tables/:id/data/row           Clear a row's data
GET      /api/tables/:id/export/csv         Download as CSV
GET      /api/tables/:id/export/xlsx        Download as XLSX
```

### 1.2 Request / Response Shape

```typescript
// lib/api/types.ts

// ═══════════════════════════════════════════════════════════
// STANDARD RESPONSE ENVELOPE
// ═══════════════════════════════════════════════════════════

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

export interface ApiError {
  code: string;        // Machine-readable (e.g., "TABLE_NOT_FOUND")
  message: string;     // Human-readable
  details?: unknown;   // Optional extra context
}

// ═══════════════════════════════════════════════════════════
// HTTP STATUS CONVENTIONS
// ═══════════════════════════════════════════════════════════

// 200  OK            – Successful GET / PATCH / DELETE
// 201  Created       – Successful POST (resource created)
// 400  Bad Request   – Missing / invalid input
// 401  Unauthorized  – Missing or invalid auth token
// 403  Forbidden     – Authenticated but lacks permission
// 404  Not Found     – Resource doesn't exist
// 409  Conflict      – Duplicate / constraint violation
// 422  Unprocessable – Validation error (well-formed but invalid)
// 429  Too Many Req  – Rate limit exceeded
// 500  Server Error  – Unexpected internal failure
```

### 1.3 Authentication Strategy

```typescript
// lib/api/auth.ts

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

/**
 * Returns the authenticated Supabase client and current user.
 * Throws a structured error if the session is missing or expired.
 */
export async function requireAuth(request: NextRequest) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiAuthError('Not authenticated');
  }

  return { supabase, user };
}

export class ApiAuthError extends Error {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Unauthorized') {
    super(message);
  }
}
```

---

## 2. Voice Pipeline Routes

### 2.1 POST /api/transcribe

```typescript
// app/api/transcribe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/api/auth';
import { errorResponse } from '@/lib/api/errors';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ═══════════════════════════════════════════════════════════
// REQUEST
// Content-Type: multipart/form-data
// Body:
//   audio  File    – WebM/Opus blob from MediaRecorder
//   lang   string? – ISO 639-1 code ("en", "he"). Default: auto
//
// RESPONSE 200
// {
//   success: true,
//   data: {
//     transcript: string,
//     duration_ms: number,
//     language_detected: string
//   }
// }
// ═══════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const lang = (formData.get('lang') as string | null) ?? undefined;

    if (!audioFile) {
      return errorResponse('MISSING_AUDIO', 'No audio file provided.', 400);
    }

    // Enforce size limit: 25 MB (Whisper maximum)
    const MAX_BYTES = 25 * 1024 * 1024;
    if (audioFile.size > MAX_BYTES) {
      return errorResponse(
        'AUDIO_TOO_LARGE',
        'Audio must be under 25 MB. Try a shorter recording.',
        400
      );
    }

    const startTime = Date.now();

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: lang,
      response_format: 'verbose_json', // includes language + segments
    });

    const duration_ms = Date.now() - startTime;

    if (!transcription.text?.trim()) {
      return errorResponse(
        'STT_NO_SPEECH',
        "Couldn't detect any speech. Try speaking louder or closer to the mic.",
        422
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          transcript: transcription.text.trim(),
          duration_ms,
          language_detected: transcription.language ?? 'unknown',
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
```

### 2.2 POST /api/parse

```typescript
// app/api/parse/route.ts

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { requireAuth } from '@/lib/api/auth';
import { errorResponse, handleRouteError } from '@/lib/api/errors';
import type { TableSchema } from '@/lib/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ═══════════════════════════════════════════════════════════
// REQUEST BODY SCHEMA
// ═══════════════════════════════════════════════════════════

const ParseRequestSchema = z.object({
  transcript: z.string().min(1),
  schema: z.object({
    columns: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.enum(['text', 'number', 'boolean', 'date']),
        validation: z
          .object({
            min: z.number().optional(),
            max: z.number().optional(),
          })
          .optional(),
      })
    ),
    rows: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
      })
    ),
  }),
  activeColumnId: z.string(),
  navigationMode: z.enum(['column-first', 'row-first']),
});

// ═══════════════════════════════════════════════════════════
// RESPONSE SHAPE
// {
//   success: true,
//   data: {
//     action: "UPDATE_CELL" | "AMBIGUOUS" | "NO_MATCH",
//     entity: string | null,
//     entityMatch: {
//       original: string,
//       matched: string | null,
//       confidence: number
//     },
//     value: unknown,
//     valueValid: boolean,
//     alternatives?: Array<{ rowId: string; label: string; confidence: number }>,
//     reasoning: string
//   }
// }
// ═══════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const parsed = ParseRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        'INVALID_REQUEST',
        'Request body is malformed.',
        400,
        parsed.error.flatten()
      );
    }

    const { transcript, schema, activeColumnId, navigationMode } = parsed.data;

    const activeColumn = schema.columns.find((c) => c.id === activeColumnId);
    if (!activeColumn) {
      return errorResponse('COLUMN_NOT_FOUND', `Column "${activeColumnId}" not found.`, 404);
    }

    const systemPrompt = buildSystemPrompt(schema, activeColumn, navigationMode);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 256,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? '{}';
    let result: unknown;

    try {
      result = JSON.parse(rawContent);
    } catch {
      return errorResponse('PARSE_JSON_FAILED', 'LLM returned invalid JSON.', 500);
    }

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}

// ═══════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════

function buildSystemPrompt(
  schema: TableSchema,
  activeColumn: TableSchema['columns'][number],
  navigationMode: string
): string {
  const rowLabels = schema.rows.map((r) => `"${r.label}" (id: ${r.id})`).join(', ');
  const validationHint =
    activeColumn.type === 'number' && activeColumn.validation
      ? `Range: ${activeColumn.validation.min ?? '-∞'} – ${activeColumn.validation.max ?? '+∞'}.`
      : '';

  return `
You are a voice-to-table data entry parser.

Table rows: [${rowLabels}]
Active column: "${activeColumn.label}" (type: ${activeColumn.type}). ${validationHint}
Navigation mode: ${navigationMode}

The user has spoken a data entry. Extract:
1. entity – the row they are referring to (fuzzy/phonetic match allowed)
2. value  – the cell value for the active column

Return ONLY valid JSON with this shape:
{
  "action": "UPDATE_CELL" | "AMBIGUOUS" | "NO_MATCH",
  "entity": "<matched row label or null>",
  "entityMatch": {
    "original": "<what user said>",
    "matched": "<best row label or null>",
    "confidence": 0.0
  },
  "value": <extracted value or null>,
  "valueValid": true | false,
  "alternatives": [],
  "reasoning": "<one sentence>"
}

Rules:
- confidence: 1.0 = exact, 0.9 = phonetic, 0.8 = fuzzy, below 0.75 = AMBIGUOUS
- If multiple rows are close matches, set action to AMBIGUOUS and list them in alternatives
- If no row matches at all, set action to NO_MATCH
- For type "number", convert words to digits ("eighty five" → 85)
- For type "boolean", map yes/present/true → true, no/absent/false → false
- For type "date", convert relative ("today", "tomorrow") to ISO 8601
`.trim();
}
```

---

## 3. Table Routes

### 3.1 GET /api/tables

```typescript
// app/api/tables/route.ts  (GET handler)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/errors';

// ═══════════════════════════════════════════════════════════
// RESPONSE 200
// {
//   success: true,
//   data: Array<{
//     id: string,
//     name: string,
//     description: string | null,
//     created_at: string,
//     updated_at: string,
//     row_count: number   ← derived via Postgres function
//   }>
// }
// ═══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAuth(request);

    const { data, error } = await supabase
      .from('tables')
      .select(
        `
        id,
        name,
        description,
        created_at,
        updated_at,
        schema->rows
      `
      )
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Derive row_count from the embedded JSONB array length
    const enriched = (data ?? []).map((t) => ({
      ...t,
      row_count: Array.isArray(t.rows) ? t.rows.length : 0,
      rows: undefined, // strip raw JSONB from response
    }));

    return NextResponse.json({ success: true, data: enriched }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

### 3.2 POST /api/tables

```typescript
// app/api/tables/route.ts  (POST handler)

import { z } from 'zod';
import { errorResponse } from '@/lib/api/errors';

const CreateTableSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  schema: z.object({
    columns: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.enum(['text', 'number', 'boolean', 'date']),
        required: z.boolean().optional(),
        validation: z.record(z.unknown()).optional(),
      })
    ).min(1),
    rows: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        metadata: z.record(z.unknown()).optional(),
      })
    ),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);

    const body = await request.json();
    const parsed = CreateTableSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('INVALID_REQUEST', 'Invalid table definition.', 400, parsed.error.flatten());
    }

    const { name, description, schema } = parsed.data;

    const { data, error } = await supabase
      .from('tables')
      .insert({
        user_id: user.id,
        name,
        description: description ?? null,
        schema,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return errorResponse('DUPLICATE_NAME', `A table named "${name}" already exists.`, 409);
      }
      throw error;
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

### 3.3 GET /api/tables/[id]

```typescript
// app/api/tables/[id]/route.ts  (GET handler)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { errorResponse, handleRouteError } from '@/lib/api/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await requireAuth(request);

    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error?.code === 'PGRST116') {
      return errorResponse('TABLE_NOT_FOUND', `Table "${params.id}" not found.`, 404);
    }
    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

### 3.4 PATCH /api/tables/[id]

```typescript
// app/api/tables/[id]/route.ts  (PATCH handler)

import { z } from 'zod';

const UpdateTableSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    schema: z.record(z.unknown()).optional(), // partial schema update
    settings: z.record(z.unknown()).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided.',
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await requireAuth(request);

    const body = await request.json();
    const parsed = UpdateTableSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('INVALID_REQUEST', 'Invalid update payload.', 400, parsed.error.flatten());
    }

    const { data, error } = await supabase
      .from('tables')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single();

    if (error?.code === 'PGRST116') {
      return errorResponse('TABLE_NOT_FOUND', `Table "${params.id}" not found.`, 404);
    }
    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

### 3.5 DELETE /api/tables/[id]

```typescript
// app/api/tables/[id]/route.ts  (DELETE handler)

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await requireAuth(request);

    // table_data rows are removed via ON DELETE CASCADE in Postgres
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', params.id);

    if (error?.code === 'PGRST116') {
      return errorResponse('TABLE_NOT_FOUND', `Table "${params.id}" not found.`, 404);
    }
    if (error) throw error;

    return NextResponse.json({ success: true, data: { deleted: params.id } }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

---

## 4. Table Data Routes

### 4.1 GET /api/tables/[id]/data

```typescript
// app/api/tables/[id]/data/route.ts  (GET handler)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { errorResponse, handleRouteError } from '@/lib/api/errors';

// ═══════════════════════════════════════════════════════════
// RESPONSE 200
// {
//   success: true,
//   data: Array<{
//     id: string,
//     table_id: string,
//     row_id: string,
//     column_id: string,
//     value: { v: unknown },
//     created_at: string,
//     updated_at: string
//   }>
// }
// ═══════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await requireAuth(request);

    // Optional: filter by row or column via query params
    const url = new URL(request.url);
    const rowId = url.searchParams.get('row_id');
    const columnId = url.searchParams.get('column_id');

    let query = supabase
      .from('table_data')
      .select('*')
      .eq('table_id', params.id);

    if (rowId) query = query.eq('row_id', rowId);
    if (columnId) query = query.eq('column_id', columnId);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

### 4.2 PUT /api/tables/[id]/data/cell

```typescript
// app/api/tables/[id]/data/cell/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api/auth';
import { errorResponse, handleRouteError } from '@/lib/api/errors';

const UpsertCellSchema = z.object({
  row_id: z.string().min(1),
  column_id: z.string().min(1),
  value: z.unknown(), // validated against column schema server-side
});

// ═══════════════════════════════════════════════════════════
// PUT  – Upsert a single cell (INSERT or UPDATE)
//
// BODY:  { row_id, column_id, value }
// RESPONSE 200: { success: true, data: <table_data row> }
// ═══════════════════════════════════════════════════════════

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await requireAuth(request);

    const body = await request.json();
    const parsed = UpsertCellSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('INVALID_REQUEST', 'Invalid cell payload.', 400, parsed.error.flatten());
    }

    const { row_id, column_id, value } = parsed.data;

    // Verify ownership (RLS will also enforce this, but explicit check gives better errors)
    const { data: tableRow, error: tableErr } = await supabase
      .from('tables')
      .select('id, schema')
      .eq('id', params.id)
      .single();

    if (tableErr?.code === 'PGRST116') {
      return errorResponse('TABLE_NOT_FOUND', `Table "${params.id}" not found.`, 404);
    }
    if (tableErr) throw tableErr;

    // Validate column exists in schema
    const column = (tableRow.schema as any).columns?.find(
      (c: any) => c.id === column_id
    );
    if (!column) {
      return errorResponse('COLUMN_NOT_FOUND', `Column "${column_id}" not found in schema.`, 404);
    }

    // Type validation
    const validationError = validateCellValue(value, column);
    if (validationError) {
      return errorResponse('VALIDATION_ERROR', validationError, 422);
    }

    const { data, error } = await supabase
      .from('table_data')
      .upsert(
        {
          table_id: params.id,
          row_id,
          column_id,
          value: { v: value },
        },
        { onConflict: 'table_id,row_id,column_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}

// ═══════════════════════════════════════════════════════════
// CELL VALUE VALIDATOR
// ═══════════════════════════════════════════════════════════

function validateCellValue(value: unknown, column: any): string | null {
  if (column.required && (value === null || value === undefined || value === '')) {
    return `${column.label} is required.`;
  }
  if (value === null || value === undefined) return null;

  switch (column.type) {
    case 'number': {
      const n = Number(value);
      if (isNaN(n)) return `${column.label} must be a number.`;
      if (column.validation?.min !== undefined && n < column.validation.min) {
        return `${column.label} must be ≥ ${column.validation.min}.`;
      }
      if (column.validation?.max !== undefined && n > column.validation.max) {
        return `${column.label} must be ≤ ${column.validation.max}.`;
      }
      break;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') return `${column.label} must be true or false.`;
      break;
    }
    case 'date': {
      if (isNaN(Date.parse(String(value)))) return `${column.label} must be a valid date.`;
      break;
    }
    case 'text': {
      if (column.validation?.maxLength && String(value).length > column.validation.maxLength) {
        return `${column.label} must be ≤ ${column.validation.maxLength} characters.`;
      }
      break;
    }
  }
  return null;
}
```

### 4.3 DELETE /api/tables/[id]/data/row

```typescript
// app/api/tables/[id]/data/row/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { errorResponse, handleRouteError } from '@/lib/api/errors';

// ═══════════════════════════════════════════════════════════
// DELETE  – Remove all cell values for a given row_id
// Query param: ?row_id=<id>
// ═══════════════════════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await requireAuth(request);

    const url = new URL(request.url);
    const rowId = url.searchParams.get('row_id');

    if (!rowId) {
      return errorResponse('MISSING_ROW_ID', 'Query param "row_id" is required.', 400);
    }

    const { error } = await supabase
      .from('table_data')
      .delete()
      .eq('table_id', params.id)
      .eq('row_id', rowId);

    if (error) throw error;

    return NextResponse.json(
      { success: true, data: { deleted_row: rowId } },
      { status: 200 }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
```

---

## 5. Export Routes

### 5.1 GET /api/tables/[id]/export/csv

```typescript
// app/api/tables/[id]/export/csv/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/errors';
import type { TableSchema } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await requireAuth(request);

    // 1. Fetch schema
    const { data: tableRow, error: tableErr } = await supabase
      .from('tables')
      .select('name, schema')
      .eq('id', params.id)
      .single();

    if (tableErr) throw tableErr;

    const schema = tableRow.schema as TableSchema;

    // 2. Fetch all cell values
    const { data: cells, error: cellsErr } = await supabase
      .from('table_data')
      .select('row_id, column_id, value')
      .eq('table_id', params.id);

    if (cellsErr) throw cellsErr;

    // 3. Build lookup map: { rowId: { columnId: value } }
    const lookup: Record<string, Record<string, unknown>> = {};
    for (const cell of cells ?? []) {
      if (!lookup[cell.row_id]) lookup[cell.row_id] = {};
      lookup[cell.row_id][cell.column_id] = (cell.value as any)?.v ?? '';
    }

    // 4. Build CSV string
    const headers = ['Row Label', ...schema.columns.map((c) => c.label)];
    const csvLines: string[] = [headers.map(escapeCSV).join(',')];

    for (const row of schema.rows) {
      const rowData = lookup[row.id] ?? {};
      const line = [
        row.label,
        ...schema.columns.map((col) => rowData[col.id] ?? ''),
      ].map(escapeCSV).join(',');
      csvLines.push(line);
    }

    const csv = csvLines.join('\r\n');
    const filename = `${tableRow.name.replace(/[^a-z0-9]/gi, '_')}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

function escapeCSV(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

### 5.2 GET /api/tables/[id]/export/xlsx

```typescript
// app/api/tables/[id]/export/xlsx/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAuth } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/errors';
import type { TableSchema } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = await requireAuth(request);

    const { data: tableRow, error: tableErr } = await supabase
      .from('tables')
      .select('name, schema')
      .eq('id', params.id)
      .single();

    if (tableErr) throw tableErr;

    const schema = tableRow.schema as TableSchema;

    const { data: cells, error: cellsErr } = await supabase
      .from('table_data')
      .select('row_id, column_id, value')
      .eq('table_id', params.id);

    if (cellsErr) throw cellsErr;

    // Build lookup
    const lookup: Record<string, Record<string, unknown>> = {};
    for (const cell of cells ?? []) {
      if (!lookup[cell.row_id]) lookup[cell.row_id] = {};
      lookup[cell.row_id][cell.column_id] = (cell.value as any)?.v ?? null;
    }

    // Build worksheet data (array of arrays)
    const headers = ['Row Label', ...schema.columns.map((c) => c.label)];
    const rows = schema.rows.map((row) => {
      const rowData = lookup[row.id] ?? {};
      return [row.label, ...schema.columns.map((col) => rowData[col.id] ?? null)];
    });

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Style header row (bold)
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = { font: { bold: true } };
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `${tableRow.name.replace(/[^a-z0-9]/gi, '_')}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

---

## 6. Shared Utilities

### 6.1 Auth Helper

*(See [Section 1.3](#13-authentication-strategy) for the full implementation.)*

### 6.2 Error Response Helper

```typescript
// lib/api/errors.ts

import { NextResponse } from 'next/server';
import { ApiAuthError } from './auth';

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status }
  );
}

export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof ApiAuthError) {
    return errorResponse(err.code, err.message, err.statusCode);
  }

  // Supabase / Postgres errors
  if (err && typeof err === 'object' && 'code' in err) {
    const pgErr = err as { code: string; message: string };
    console.error('[DB Error]', pgErr.code, pgErr.message);
    return errorResponse('DB_ERROR', 'A database error occurred.', 500);
  }

  console.error('[Unhandled Error]', err);
  return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
}
```

### 6.3 Validation Helper

```typescript
// lib/api/validate.ts

import { z, ZodSchema } from 'zod';
import { errorResponse } from './errors';
import { NextResponse } from 'next/server';

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns { data } on success, or a ready-made NextResponse on failure.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      error: errorResponse('INVALID_JSON', 'Request body must be valid JSON.', 400),
    };
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    return {
      data: null,
      error: errorResponse(
        'VALIDATION_ERROR',
        'Request body failed validation.',
        400,
        result.error.flatten()
      ),
    };
  }

  return { data: result.data, error: null };
}
```

---

## 7. Route Summary Table

```
┌─────────────────────────────────────────────────────────────────────────┐
│  METHOD   PATH                              AUTH   DESCRIPTION           │
├─────────────────────────────────────────────────────────────────────────┤
│  POST     /api/transcribe                   ✅     Audio → transcript    │
│  POST     /api/parse                        ✅     Transcript → result   │
├─────────────────────────────────────────────────────────────────────────┤
│  GET      /api/tables                       ✅     List user's tables    │
│  POST     /api/tables                       ✅     Create table          │
│  GET      /api/tables/:id                   ✅     Get table + schema    │
│  PATCH    /api/tables/:id                   ✅     Update table meta     │
│  DELETE   /api/tables/:id                   ✅     Delete table          │
├─────────────────────────────────────────────────────────────────────────┤
│  GET      /api/tables/:id/data              ✅     Get all cell data     │
│  PUT      /api/tables/:id/data/cell         ✅     Upsert single cell    │
│  DELETE   /api/tables/:id/data/row          ✅     Clear a row           │
├─────────────────────────────────────────────────────────────────────────┤
│  GET      /api/tables/:id/export/csv        ✅     Download CSV          │
│  GET      /api/tables/:id/export/xlsx       ✅     Download XLSX         │
└─────────────────────────────────────────────────────────────────────────┘

All routes require a valid Supabase session cookie.
Row Level Security (RLS) on the database enforces ownership as a second layer.
```

---

*End of API Routes Documentation*
