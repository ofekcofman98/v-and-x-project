# VocalGrid - Implementation Roadmap

**Chapter:** 12  
**Dependencies:** 01_OVERVIEW.md, 02_ARCHITECTURE.md  
**Related:** 13_TESTING_DEPLOYMENT.md

---

## Table of Contents

1. [Overview](#1-overview)
   - 1.1 [Timeline at a Glance](#11-timeline-at-a-glance)
   - 1.2 [How to Use This Document](#12-how-to-use-this-document)

2. [Phase 1 — Foundation (Week 1)](#2-phase-1--foundation-week-1)
   - 2.1 [Days 1–2: Project Bootstrap](#21-days-12-project-bootstrap)
   - 2.2 [Days 3–5: Basic Table UI](#22-days-35-basic-table-ui)
   - 2.3 [Days 6–7: Voice Recording](#23-days-67-voice-recording)
   - 2.4 [Phase 1 Exit Criteria](#24-phase-1-exit-criteria)

3. [Phase 2 — Voice Pipeline (Week 2)](#3-phase-2--voice-pipeline-week-2)
   - 3.1 [Days 8–10: STT Integration](#31-days-810-stt-integration)
   - 3.2 [Days 11–12: Context Parsing](#32-days-1112-context-parsing)
   - 3.3 [Days 13–14: Table Mutations](#33-days-1314-table-mutations)
   - 3.4 [Phase 2 Exit Criteria](#34-phase-2-exit-criteria)

4. [Phase 3 — Smart Features (Week 3)](#4-phase-3--smart-features-week-3)
   - 4.1 [Days 15–17: Fuzzy Matching](#41-days-1517-fuzzy-matching)
   - 4.2 [Days 18–19: Confirmation Flow](#42-days-1819-confirmation-flow)
   - 4.3 [Days 20–21: Smart Pointer](#43-days-2021-smart-pointer)
   - 4.4 [Phase 3 Exit Criteria](#44-phase-3-exit-criteria)

5. [Phase 4 — Polish & Deploy (Week 4)](#5-phase-4--polish--deploy-week-4)
   - 5.1 [Days 22–24: Error Handling](#51-days-2224-error-handling)
   - 5.2 [Days 25–26: Export & Table Management](#52-days-2526-export--table-management)
   - 5.3 [Days 27–28: Deploy & Portfolio](#53-days-2728-deploy--portfolio)
   - 5.4 [Phase 4 Exit Criteria](#54-phase-4-exit-criteria)

6. [Task Reference (Full Checklist)](#6-task-reference-full-checklist)

7. [Risk Register](#7-risk-register)

8. [Post-MVP Roadmap](#8-post-mvp-roadmap)

---

## 1. Overview

### 1.1 Timeline at a Glance

```
┌──────────────────────────────────────────────────────────────────────┐
│  WEEK 1          WEEK 2          WEEK 3          WEEK 4              │
│  Foundation      Voice Pipeline  Smart Features  Polish & Deploy     │
│                                                                      │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓      │
│                                                                      │
│  - Next.js setup  - Whisper API   - Fuzzy match   - Error handling  │
│  - DB schema      - GPT parsing   - Confirmation  - CSV/XLSX export │
│  - Table UI       - Mutations     - Smart pointer - Vercel deploy   │
│  - Voice capture  - Optimistic UI - State machine - Portfolio prep  │
│                                                                      │
│  Deliverable:     Deliverable:    Deliverable:    Deliverable:       │
│  Record audio +   Voice → table   All smart UX    Live at           │
│  see table UI     update works    working         vocalgrid.app     │
└──────────────────────────────────────────────────────────────────────┘

Total: 4 weeks × ~3 hrs/day = ~84 hours of focused work
Buffer: +1 week for debugging / unexpected complexity
```

### 1.2 How to Use This Document

```
Each phase contains:
  1. Day-by-day task breakdown
  2. Concrete TypeScript implementation stubs
  3. Exit criteria (don't move on until these pass)
  4. Time estimate per task

Notation:
  ✅  Done
  🔄  In progress
  ⬜  Not started
  ⚠️  Blocked
```

---

## 2. Phase 1 — Foundation (Week 1)

### 2.1 Days 1–2: Project Bootstrap

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. Init Next.js 15 with App Router + TypeScript
// ⬜ 2. Install and configure Tailwind CSS
// ⬜ 3. Add shadcn/ui (Button, Table, Dialog, Toast)
// ⬜ 4. Create Supabase project (free tier)
// ⬜ 5. Run database migrations (see 03_DATABASE.md)
// ⬜ 6. Add .env.local with keys
// ⬜ 7. Init Git repo + push initial commit
// ⬜ 8. Write README skeleton with badges

// ─────────────────────────────────────────────
// COMMANDS (run in order)
// ─────────────────────────────────────────────

/*
npx create-next-app@latest vocalgrid \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd vocalgrid
npx shadcn-ui@latest init
npx shadcn-ui@latest add button table dialog toast badge

npm install @supabase/supabase-js @supabase/ssr
npm install zustand @tanstack/react-query @tanstack/react-query-devtools
npm install openai
npm install zod
npm install xlsx                     # XLSX export
npm install fastest-levenshtein      # Fuzzy matching
npm install soundex-code             # Phonetic matching
npm install chrono-node              # Natural date parsing
*/

// ─────────────────────────────────────────────
// ENVIRONMENT VARIABLES  (.env.local)
// ─────────────────────────────────────────────

// NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
// NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
// SUPABASE_SERVICE_ROLE_KEY=eyJh...    # Server-side only
// OPENAI_API_KEY=sk-...

// ─────────────────────────────────────────────
// FOLDER STRUCTURE  (target by end of Day 2)
// ─────────────────────────────────────────────

/*
vocalgrid/
├── app/
│   ├── layout.tsx           # Root layout + Providers
│   ├── page.tsx             # Landing / table list
│   ├── table/
│   │   └── [id]/
│   │       └── page.tsx     # Table view
│   └── api/
│       ├── transcribe/route.ts
│       ├── parse/route.ts
│       └── tables/
│           └── [...route].ts
├── components/
│   ├── DataTable.tsx
│   ├── VoiceRecorder.tsx
│   ├── SmartPointer.tsx
│   └── ConfirmationDialog.tsx
├── lib/
│   ├── supabase.ts
│   ├── stores/
│   │   └── ui-store.ts
│   ├── queries/
│   │   └── tables.ts
│   ├── mutations/
│   │   └── table-data.ts
│   ├── api/
│   │   ├── auth.ts
│   │   └── errors.ts
│   └── types.ts
└── docs/                    # This documentation
*/

// TIME ESTIMATE: 4–6 hours
```

### 2.2 Days 3–5: Basic Table UI

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. Build static DataTable component
// ⬜ 2. Wire Zustand store (activeCell, setActiveCell)
// ⬜ 3. Cell click → highlight active cell
// ⬜ 4. Navigation mode toggle (column-first / row-first)
// ⬜ 5. Keyboard navigation (arrow keys)
// ⬜ 6. Create table from mock data (hardcoded schema)

// ─────────────────────────────────────────────
// IMPLEMENTATION STUB
// ─────────────────────────────────────────────

// components/DataTable.tsx
import { useUIStore } from '@/lib/stores/ui-store';
import type { TableSchema } from '@/lib/types';

interface DataTableProps {
  schema: TableSchema;
  data: Record<string, Record<string, unknown>>; // { rowId: { colId: value } }
}

export function DataTable({ schema, data }: DataTableProps) {
  const activeCell = useUIStore((s) => s.activeCell);
  const setActiveCell = useUIStore((s) => s.setActiveCell);

  return (
    <div className="overflow-auto rounded-lg border border-zinc-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50">
            <th className="px-4 py-2 text-left font-semibold text-zinc-600">
              {schema.columns[0]?.label ?? 'Row'}
            </th>
            {schema.columns.slice(1).map((col) => (
              <th key={col.id} className="px-4 py-2 text-left font-semibold text-zinc-600">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schema.rows.map((row) => (
            <tr key={row.id} className="border-t border-zinc-100 hover:bg-zinc-50">
              <td className="px-4 py-2 font-medium text-zinc-800">{row.label}</td>
              {schema.columns.slice(1).map((col) => {
                const isActive =
                  activeCell?.rowId === row.id && activeCell?.columnId === col.id;
                const value = data[row.id]?.[col.id];

                return (
                  <td
                    key={col.id}
                    onClick={() => setActiveCell({ rowId: row.id, columnId: col.id })}
                    className={[
                      'px-4 py-2 cursor-pointer transition-colors',
                      isActive
                        ? 'bg-blue-100 outline outline-2 outline-blue-400'
                        : 'hover:bg-blue-50',
                    ].join(' ')}
                  >
                    {value !== undefined && value !== null ? String(value) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// TIME ESTIMATE: 6–9 hours
```

### 2.3 Days 6–7: Voice Recording

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. Build VoiceRecorder component
// ⬜ 2. Integrate MediaRecorder API (press-to-record)
// ⬜ 3. Waveform animation while recording
// ⬜ 4. Convert audio chunks → Blob on stop
// ⬜ 5. Check browser compatibility
// ⬜ 6. Update Zustand: startRecording / stopRecording

// ─────────────────────────────────────────────
// IMPLEMENTATION STUB
// ─────────────────────────────────────────────

// components/VoiceRecorder.tsx
'use client';

import { useRef, useCallback } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { Mic, Square } from 'lucide-react';

interface VoiceRecorderProps {
  onAudioReady: (blob: Blob) => void;
}

export function VoiceRecorder({ onAudioReady }: VoiceRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isRecording = useUIStore((s) => s.isRecording);
  const startRecording = useUIStore((s) => s.startRecording);
  const stopRecording = useUIStore((s) => s.stopRecording);
  const recordingState = useUIStore((s) => s.recordingState);

  const handleStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onAudioReady(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100); // 100 ms chunks
      mediaRecorderRef.current = recorder;
      startRecording();
    } catch (err) {
      console.error('Microphone error:', err);
      // TODO: surface MIC_PERMISSION_DENIED error
    }
  }, [onAudioReady, startRecording]);

  const handleStop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopRecording();
  }, [stopRecording]);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onPointerDown={handleStart}
        onPointerUp={handleStop}
        disabled={recordingState === 'processing'}
        className={[
          'flex h-16 w-16 items-center justify-center rounded-full transition-all',
          isRecording
            ? 'bg-red-500 shadow-lg shadow-red-300 scale-110'
            : 'bg-blue-600 hover:bg-blue-700',
          'text-white',
        ].join(' ')}
      >
        {isRecording ? <Square size={24} /> : <Mic size={24} />}
      </button>

      <span className="text-xs text-zinc-500">
        {isRecording
          ? 'Recording… release to stop'
          : recordingState === 'processing'
          ? 'Processing…'
          : 'Hold to record'}
      </span>
    </div>
  );
}

// TIME ESTIMATE: 4–6 hours
```

### 2.4 Phase 1 Exit Criteria

```typescript
// ─────────────────────────────────────────────
// ALL MUST PASS BEFORE STARTING PHASE 2
// ─────────────────────────────────────────────

const phase1ExitCriteria = [
  'Next.js app runs locally on http://localhost:3000',
  'Supabase project connected; tables + table_data created',
  'DataTable renders hardcoded schema correctly',
  'Clicking a cell highlights it; Zustand activeCell updates',
  'Navigation mode toggle switches between column-first and row-first',
  'VoiceRecorder starts / stops on button press; Blob is produced',
  'No TypeScript errors (npm run type-check passes)',
  'Git commit pushed with descriptive message',
];
```

---

## 3. Phase 2 — Voice Pipeline (Week 2)

### 3.1 Days 8–10: STT Integration

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. Implement POST /api/transcribe (see 11_API_ROUTES.md §2.1)
// ⬜ 2. Client: upload Blob via FormData on recording stop
// ⬜ 3. Display raw transcript below recorder (debug view)
// ⬜ 4. Handle STT errors (no speech, timeout, rate limit)
// ⬜ 5. Show loading spinner while awaiting response

// ─────────────────────────────────────────────
// CLIENT-SIDE UPLOAD HELPER
// ─────────────────────────────────────────────

// lib/voice/transcribe.ts

export interface TranscribeResult {
  transcript: string;
  duration_ms: number;
  language_detected: string;
}

export async function transcribeAudio(blob: Blob): Promise<TranscribeResult> {
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    body: form,
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error?.message ?? 'Transcription failed');
  }

  return json.data as TranscribeResult;
}

// TIME ESTIMATE: 5–7 hours
```

### 3.2 Days 11–12: Context Parsing

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. Implement POST /api/parse (see 11_API_ROUTES.md §2.2)
// ⬜ 2. Client: call /api/parse with transcript + table context
// ⬜ 3. Log raw LLM response for review
// ⬜ 4. Map parsed result → Zustand pendingConfirmation
// ⬜ 5. Handle AMBIGUOUS and NO_MATCH actions

// ─────────────────────────────────────────────
// CLIENT-SIDE PARSE HELPER
// ─────────────────────────────────────────────

// lib/voice/parse.ts

import type { TableSchema } from '@/lib/types';

export interface ParseResult {
  action: 'UPDATE_CELL' | 'AMBIGUOUS' | 'NO_MATCH';
  entity: string | null;
  entityMatch: {
    original: string;
    matched: string | null;
    confidence: number;
  };
  value: unknown;
  valueValid: boolean;
  alternatives?: Array<{ rowId: string; label: string; confidence: number }>;
  reasoning: string;
}

export async function parseTranscript(
  transcript: string,
  schema: TableSchema,
  activeColumnId: string,
  navigationMode: 'column-first' | 'row-first'
): Promise<ParseResult> {
  const res = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, schema, activeColumnId, navigationMode }),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error?.message ?? 'Parse failed');
  }

  return json.data as ParseResult;
}

// TIME ESTIMATE: 4–6 hours
```

### 3.3 Days 13–14: Table Mutations

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. Set up TanStack Query (see 04_STATE_MANAGEMENT.md §3.1)
// ⬜ 2. Implement useUpdateCell mutation (optimistic update)
// ⬜ 3. Wire confirm button → mutation → cell update
// ⬜ 4. Cell flash green animation on success
// ⬜ 5. Rollback on network error (toast notification)
// ⬜ 6. Real data from Supabase (replace hardcoded mock)

// ─────────────────────────────────────────────
// CELL FLASH ANIMATION (Tailwind + JS)
// ─────────────────────────────────────────────

// components/DataTable.tsx  (cell fragment)

/*
  After a successful mutation:
  1. Add 'animate-flash-green' class to the cell
  2. Remove after 800ms

  tailwind.config.ts:
  extend: {
    keyframes: {
      flashGreen: {
        '0%, 100%': { backgroundColor: 'transparent' },
        '50%':       { backgroundColor: '#bbf7d0' },  // green-200
      },
    },
    animation: {
      'flash-green': 'flashGreen 0.8s ease-in-out',
    },
  }
*/

// Usage in DataTable:
// const [flashingCell, setFlashingCell] = useState<string | null>(null);
//
// onSuccess: () => {
//   const key = `${rowId}:${colId}`;
//   setFlashingCell(key);
//   setTimeout(() => setFlashingCell(null), 800);
// }
//
// className={flashingCell === `${row.id}:${col.id}` ? 'animate-flash-green' : ''}

// TIME ESTIMATE: 5–7 hours
```

### 3.4 Phase 2 Exit Criteria

```typescript
const phase2ExitCriteria = [
  'Speaking into mic → transcript appears in UI within 3 seconds',
  '/api/parse correctly identifies row and value from transcript',
  'Confirmed entry updates the correct cell in Supabase',
  'Optimistic update shows immediately (no loading flicker)',
  'Cell flashes green on success',
  'Network error triggers rollback and error toast',
  'End-to-end latency (record stop → result) < 5 seconds',
];
```

---

## 4. Phase 3 — Smart Features (Week 3)

### 4.1 Days 15–17: Fuzzy Matching

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. Levenshtein distance matching
// ⬜ 2. Soundex phonetic matching
// ⬜ 3. Cascading fallback pipeline
// ⬜ 4. Confidence scoring
// ⬜ 5. Unit tests for matching edge cases

// ─────────────────────────────────────────────
// IMPLEMENTATION STUB (see 07_MATCHING_ENGINE.md for full code)
// ─────────────────────────────────────────────

// lib/matching/index.ts

import { distance } from 'fastest-levenshtein';
import soundex from 'soundex-code';

export interface MatchResult {
  rowId: string;
  label: string;
  confidence: number;
  method: 'exact' | 'soundex' | 'levenshtein' | 'llm';
}

export function findBestMatch(
  query: string,
  rows: Array<{ id: string; label: string }>
): MatchResult | null {
  const q = query.toLowerCase().trim();

  // Step 1: Exact match
  for (const row of rows) {
    if (row.label.toLowerCase() === q) {
      return { rowId: row.id, label: row.label, confidence: 1.0, method: 'exact' };
    }
  }

  // Step 2: Soundex phonetic
  const qSoundex = soundex(q);
  for (const row of rows) {
    if (soundex(row.label) === qSoundex) {
      return { rowId: row.id, label: row.label, confidence: 0.9, method: 'soundex' };
    }
  }

  // Step 3: Levenshtein (threshold ≤ 2)
  let bestDist = Infinity;
  let bestRow: (typeof rows)[number] | null = null;

  for (const row of rows) {
    const d = distance(q, row.label.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      bestRow = row;
    }
  }

  if (bestRow && bestDist <= 2) {
    const confidence = 1 - bestDist * 0.05;
    return { rowId: bestRow.id, label: bestRow.label, confidence, method: 'levenshtein' };
  }

  // Step 4: Delegate to LLM (handled in /api/parse)
  return null;
}

// TIME ESTIMATE: 5–7 hours
```

### 4.2 Days 18–19: Confirmation Flow

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. Build ConfirmationDialog component
// ⬜ 2. Auto-confirm timer (2 s) when confidence ≥ 0.85
// ⬜ 3. Manual confirm / cancel buttons
// ⬜ 4. AMBIGUOUS state: show alternatives list
// ⬜ 5. Voice selection support ("Option 1")
// ⬜ 6. Keyboard shortcut: Enter = confirm, Esc = cancel

// ─────────────────────────────────────────────
// IMPLEMENTATION STUB
// ─────────────────────────────────────────────

// components/ConfirmationDialog.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUIStore } from '@/lib/stores/ui-store';

interface ConfirmationDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  onSelectAlternative: (rowId: string) => void;
}

export function ConfirmationDialog({
  onConfirm,
  onCancel,
  onSelectAlternative,
}: ConfirmationDialogProps) {
  const pending = useUIStore((s) => s.pendingConfirmation);
  const preferences = useUIStore((s) => s.preferences);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isOpen = !!pending;
  const autoConfirm =
    pending && pending.confidence >= 0.85 && (!pending.alternatives?.length);

  useEffect(() => {
    if (!isOpen || !autoConfirm) return;

    timerRef.current = setTimeout(onConfirm, preferences.autoAdvanceDelay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, autoConfirm, onConfirm, preferences.autoAdvanceDelay]);

  if (!pending) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Detected entry</span>
            <Badge variant={pending.confidence >= 0.85 ? 'default' : 'destructive'}>
              {Math.round(pending.confidence * 100)}% confidence
            </Badge>
          </div>

          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="font-semibold text-zinc-800">{pending.entity}</p>
            <p className="text-sm text-zinc-600">
              Value: <span className="font-mono">{String(pending.value)}</span>
            </p>
          </div>

          {pending.alternatives && pending.alternatives.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Did you mean?</p>
              {pending.alternatives.map((alt, i) => (
                <button
                  key={alt.label}
                  onClick={() => onSelectAlternative(alt.label)}
                  className="w-full rounded border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  {i + 1}. {alt.label}
                </button>
              ))}
            </div>
          )}

          {autoConfirm && (
            <p className="text-center text-xs text-zinc-400">
              Auto-confirming in {preferences.autoAdvanceDelay / 1000}s…
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel (Esc)
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Confirm (Enter)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// TIME ESTIMATE: 4–6 hours
```

### 4.3 Days 20–21: Smart Pointer

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. advancePointer() in Zustand (see 04_STATE_MANAGEMENT.md §2.1)
// ⬜ 2. Visual pointer ring around active cell
// ⬜ 3. Scroll active cell into view (IntersectionObserver)
// ⬜ 4. State machine: idle → listening → processing → confirming → committed
// ⬜ 5. Voice commands: "Next column" / "Next row" / "Switch mode"
// ⬜ 6. Keyboard shortcuts (arrows, Enter, Esc)

// ─────────────────────────────────────────────
// AUTO-SCROLL ACTIVE CELL INTO VIEW
// ─────────────────────────────────────────────

// hooks/use-scroll-active-cell.ts

import { useEffect } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';

export function useScrollActiveCell() {
  const activeCell = useUIStore((s) => s.activeCell);

  useEffect(() => {
    if (!activeCell) return;

    const selector = `[data-cell-id="${activeCell.rowId}:${activeCell.columnId}"]`;
    const el = document.querySelector(selector);

    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeCell]);
}

// Each <td> should have: data-cell-id={`${row.id}:${col.id}`}

// ─────────────────────────────────────────────
// KEYBOARD SHORTCUT HANDLER
// ─────────────────────────────────────────────

// hooks/use-keyboard-shortcuts.ts

import { useEffect } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';

export function useKeyboardShortcuts(schema: TableSchema) {
  const { setActiveCell, activeCell, confirmEntry, cancelEntry } = useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { cancelEntry(); return; }
      if (e.key === 'Enter')  { confirmEntry(); return; }

      if (!activeCell) return;

      const rows = schema.rows;
      const cols = schema.columns;
      const ri = rows.findIndex((r) => r.id === activeCell.rowId);
      const ci = cols.findIndex((c) => c.id === activeCell.columnId);

      const moves: Record<string, [number, number]> = {
        ArrowDown:  [ri + 1, ci],
        ArrowUp:    [ri - 1, ci],
        ArrowRight: [ri,     ci + 1],
        ArrowLeft:  [ri,     ci - 1],
      };

      const move = moves[e.key];
      if (!move) return;

      const [nr, nc] = move;
      if (rows[nr] && cols[nc]) {
        e.preventDefault();
        setActiveCell({ rowId: rows[nr].id, columnId: cols[nc].id });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeCell, schema, setActiveCell, confirmEntry, cancelEntry]);
}

// TIME ESTIMATE: 6–8 hours
```

### 4.4 Phase 3 Exit Criteria

```typescript
const phase3ExitCriteria = [
  '"Jon Smith" matches "John Smith" via fuzzy matching (confidence ≥ 0.85)',
  'Ambiguous matches show alternatives dialog',
  'Auto-confirm fires after 2 s when confidence ≥ 0.85',
  'Pointer advances correctly in both column-first and row-first mode',
  'Arrow keys navigate the table; Enter confirms; Esc cancels',
  'Active cell scrolls into view automatically',
  'Voice commands "Next column" and "Switch to row mode" work',
];
```

---

## 5. Phase 4 — Polish & Deploy (Week 4)

### 5.1 Days 22–24: Error Handling

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. All error scenarios from 09_ERROR_HANDLING.md implemented
// ⬜ 2. Toast notifications (shadcn Toaster)
// ⬜ 3. Loading states for all async operations
// ⬜ 4. Empty states (no tables, no rows, no data)
// ⬜ 5. Browser compatibility check + graceful degradation
// ⬜ 6. Rate limiting guard on voice input (10 req/min)

// ─────────────────────────────────────────────
// BROWSER COMPAT GUARD
// ─────────────────────────────────────────────

// components/VoiceRecorder.tsx (add at top)

export function useMicrophoneSupport(): {
  supported: boolean;
  reason: string | null;
} {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'Server-side render' };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, reason: 'getUserMedia not available' };
  }
  if (!window.MediaRecorder) {
    return { supported: false, reason: 'MediaRecorder not available' };
  }
  return { supported: true, reason: null };
}

// TIME ESTIMATE: 6–8 hours
```

### 5.2 Days 25–26: Export & Table Management

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. CSV export (GET /api/tables/:id/export/csv)
// ⬜ 2. XLSX export (GET /api/tables/:id/export/xlsx)
// ⬜ 3. Create table UI (name, description, column builder)
// ⬜ 4. Edit table schema (add / rename / remove columns)
// ⬜ 5. Delete table with confirmation dialog
// ⬜ 6. Table list page with search + sort

// ─────────────────────────────────────────────
// EXPORT BUTTON COMPONENT
// ─────────────────────────────────────────────

// components/ExportMenu.tsx

'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ExportMenuProps {
  tableId: string;
  tableName: string;
}

export function ExportMenu({ tableId, tableName }: ExportMenuProps) {
  const handleExport = (format: 'csv' | 'xlsx') => {
    const url = `/api/tables/${tableId}/export/${format}`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${tableName}.${format}`;
    anchor.click();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          Download as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('xlsx')}>
          Download as Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// TIME ESTIMATE: 5–7 hours
```

### 5.3 Days 27–28: Deploy & Portfolio

```typescript
// TASK LIST
// ─────────────────────────────────────────────
// ⬜ 1. Deploy to Vercel (see 13_TESTING_DEPLOYMENT.md)
// ⬜ 2. Set all environment variables in Vercel dashboard
// ⬜ 3. Verify Supabase RLS in production
// ⬜ 4. Record Loom demo video (2–3 min)
// ⬜ 5. Write comprehensive README (see template below)
// ⬜ 6. Update portfolio site with project card
// ⬜ 7. Draft LinkedIn post

// ─────────────────────────────────────────────
// README TEMPLATE
// ─────────────────────────────────────────────

/*
# VocalGrid

> Voice-first data entry for structured tables.

![Demo GIF](./assets/demo.gif)

## Tech Stack
Next.js 15 · TypeScript · Tailwind · Supabase · OpenAI Whisper · GPT-4o-mini

## Features
- 🎙️ Press-to-record voice input
- 🧠 AI-powered entity and value extraction
- ⚡ Optimistic UI updates with rollback
- 🔄 Column-first / row-first navigation modes
- 📥 Export to CSV and Excel

## Getting Started
\`\`\`bash
git clone https://github.com/you/vocalgrid
cd vocalgrid
npm install
cp .env.example .env.local  # fill in keys
npm run dev
\`\`\`

## Architecture
See /docs for full technical specification (13 chapters).

## Live Demo
https://vocalgrid.vercel.app
*/

// TIME ESTIMATE: 4–6 hours
```

### 5.4 Phase 4 Exit Criteria

```typescript
const phase4ExitCriteria = [
  'App deployed and accessible at public URL',
  'All error scenarios show user-friendly messages (no raw stack traces)',
  'CSV and XLSX exports download correctly',
  'Create / edit / delete table flows work end-to-end',
  'Lighthouse performance score ≥ 80',
  'README includes GIF demo and setup instructions',
  'Demo video recorded and uploaded',
  'Zero console errors in production build',
];
```

---

## 6. Task Reference (Full Checklist)

```
PHASE 1 — FOUNDATION
  ⬜ Next.js 15 project init (TypeScript + Tailwind)
  ⬜ shadcn/ui components installed
  ⬜ Supabase project + DB schema
  ⬜ Environment variables configured
  ⬜ Git repo initialised
  ⬜ DataTable component (static)
  ⬜ Zustand UI store (activeCell, navigationMode)
  ⬜ Cell click → highlight
  ⬜ Navigation mode toggle
  ⬜ VoiceRecorder component (MediaRecorder)

PHASE 2 — VOICE PIPELINE
  ⬜ POST /api/transcribe (Whisper)
  ⬜ Client audio upload helper
  ⬜ POST /api/parse (GPT-4o-mini)
  ⬜ Client parse helper
  ⬜ TanStack Query setup + providers
  ⬜ useUpdateCell mutation (optimistic)
  ⬜ Cell flash animation on success
  ⬜ Error rollback + toast

PHASE 3 — SMART FEATURES
  ⬜ Levenshtein fuzzy matching
  ⬜ Soundex phonetic matching
  ⬜ Cascading fallback pipeline
  ⬜ ConfirmationDialog (auto-confirm timer)
  ⬜ AMBIGUOUS alternatives list
  ⬜ advancePointer() Zustand action
  ⬜ Auto-scroll active cell into view
  ⬜ Keyboard navigation + shortcuts
  ⬜ State machine (idle → committed)

PHASE 4 — POLISH & DEPLOY
  ⬜ All error scenarios implemented
  ⬜ Loading + empty states
  ⬜ Browser compatibility guard
  ⬜ Rate limiting (client-side)
  ⬜ CSV export endpoint + button
  ⬜ XLSX export endpoint + button
  ⬜ Create table UI
  ⬜ Edit / delete table UI
  ⬜ Vercel deployment
  ⬜ README + demo GIF
  ⬜ Loom demo video
  ⬜ Portfolio update
```

---

## 7. Risk Register

```typescript
// ═══════════════════════════════════════════════════════════
// RISK REGISTER
// Likelihood: H = High / M = Medium / L = Low
// Impact:     H = High / M = Medium / L = Low
// ═══════════════════════════════════════════════════════════

interface Risk {
  id: string;
  description: string;
  likelihood: 'H' | 'M' | 'L';
  impact: 'H' | 'M' | 'L';
  mitigation: string;
}

const risks: Risk[] = [
  {
    id: 'R01',
    description: 'Whisper latency exceeds 5 s on long recordings',
    likelihood: 'M',
    impact: 'H',
    mitigation: 'Enforce 60 s max recording duration; show progress indicator',
  },
  {
    id: 'R02',
    description: 'GPT-4o-mini returns malformed JSON',
    likelihood: 'L',
    impact: 'M',
    mitigation: 'Wrap parse in try/catch; fall back to PARSE_FAILED error',
  },
  {
    id: 'R03',
    description: 'MediaRecorder unavailable in Safari < 14.1',
    likelihood: 'L',
    impact: 'M',
    mitigation: 'Show browser upgrade notice; enable manual text input fallback',
  },
  {
    id: 'R04',
    description: 'OpenAI API costs exceed $10/day in beta',
    likelihood: 'L',
    impact: 'H',
    mitigation: 'Client-side rate limit (10 req/min); add billing alert in OpenAI dashboard',
  },
  {
    id: 'R05',
    description: 'Supabase RLS misconfiguration leaks data between users',
    likelihood: 'L',
    impact: 'H',
    mitigation: 'Test RLS policies with two separate test accounts before launch',
  },
  {
    id: 'R06',
    description: 'Fuzzy matching returns wrong row (false positive)',
    likelihood: 'M',
    impact: 'M',
    mitigation: 'Require explicit confirm for confidence < 0.85; log all matches for review',
  },
  {
    id: 'R07',
    description: 'State machine gets stuck in processing state on API timeout',
    likelihood: 'M',
    impact: 'M',
    mitigation: 'Add 30 s timeout with automatic reset to idle state',
  },
];
```

---

## 8. Post-MVP Roadmap

```
VERSION   ETA        FEATURES
─────────────────────────────────────────────────────────────────
V1.0      Week 4     MVP (see phases 1–4 above)

V1.1      +2 weeks   Vision / OCR (photo → table)
                     Streaming STT (real-time waveform transcript)
                     TTS voice feedback after each commit

V1.2      +4 weeks   Offline queuing (IndexedDB + background sync)
                     Multi-user real-time collaboration
                     Undo / Redo stack

V1.3      +8 weeks   Analytics dashboard (charts per column)
                     Pre-built table templates
                     Multi-language UI (Hebrew first)

V2.0      +4 months  Custom voice commands ("Delete row 5", "Undo")
                     Google Sheets sync
                     Zapier webhooks
                     Enterprise SSO + audit log
                     Template marketplace
```

---

*End of Implementation Roadmap Documentation*
