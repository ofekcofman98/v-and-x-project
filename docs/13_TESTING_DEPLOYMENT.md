# VocalGrid - Testing & Deployment

**Chapter:** 13  
**Dependencies:** 02_ARCHITECTURE.md, 11_API_ROUTES.md, 12_IMPLEMENTATION_ROADMAP.md  
**Related:** 09_ERROR_HANDLING.md, 10_PERFORMANCE.md

---

## Table of Contents

1. [Testing Strategy](#1-testing-strategy)
   - 1.1 [Testing Pyramid](#11-testing-pyramid)
   - 1.2 [Tools & Configuration](#12-tools--configuration)

2. [Unit Tests](#2-unit-tests)
   - 2.1 [Matching Engine Tests](#21-matching-engine-tests)
   - 2.2 [Value Parser Tests](#22-value-parser-tests)
   - 2.3 [Zustand Store Tests](#23-zustand-store-tests)

3. [Integration Tests](#3-integration-tests)
   - 3.1 [API Route Tests](#31-api-route-tests)
   - 3.2 [Database Integration Tests](#32-database-integration-tests)

4. [End-to-End Tests](#4-end-to-end-tests)
   - 4.1 [Playwright Setup](#41-playwright-setup)
   - 4.2 [Core User Journey](#42-core-user-journey)
   - 4.3 [Voice Pipeline E2E (Mocked)](#43-voice-pipeline-e2e-mocked)

5. [Performance Tests](#5-performance-tests)
   - 5.1 [Latency Benchmarks](#51-latency-benchmarks)
   - 5.2 [Rendering Performance](#52-rendering-performance)

6. [Pre-Deploy Checklist](#6-pre-deploy-checklist)

7. [Deployment Guide](#7-deployment-guide)
   - 7.1 [Environment Variables](#71-environment-variables)
   - 7.2 [Supabase Production Setup](#72-supabase-production-setup)
   - 7.3 [Vercel Deployment](#73-vercel-deployment)
   - 7.4 [Post-Deploy Verification](#74-post-deploy-verification)

8. [Monitoring & Observability](#8-monitoring--observability)
   - 8.1 [Error Tracking](#81-error-tracking)
   - 8.2 [Performance Monitoring](#82-performance-monitoring)
   - 8.3 [Cost Monitoring](#83-cost-monitoring)

---

## 1. Testing Strategy

### 1.1 Testing Pyramid

```
┌────────────────────────────────────────────────────────────────┐
│                    TESTING PYRAMID                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                        ▲                                       │
│                       ╱ ╲                                      │
│                      ╱ E2E╲          Playwright                │
│                     ╱  (3) ╲         ~5 tests                  │
│                    ╱────────╲                                   │
│                   ╱Integration╲      Vitest + MSW              │
│                  ╱    (12)    ╲      ~12 tests                  │
│                 ╱──────────────╲                                │
│                ╱   Unit Tests   ╲    Vitest                     │
│               ╱      (40+)      ╲   ~40 tests                  │
│              ╱────────────────────╲                             │
│                                                                │
│  COVERAGE TARGET:                                              │
│  • lib/matching   → 100%  (critical correctness)               │
│  • lib/stores     →  90%  (state logic)                        │
│  • app/api routes →  80%  (happy + error paths)                │
│  • components     →  60%  (smoke + interaction)                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 1.2 Tools & Configuration

```typescript
// package.json (relevant scripts)
/*
{
  "scripts": {
    "test":         "vitest run",
    "test:watch":   "vitest",
    "test:ui":      "vitest --ui",
    "test:coverage":"vitest run --coverage",
    "test:e2e":     "playwright test",
    "test:e2e:ui":  "playwright test --ui"
  }
}
*/

// Installation
/*
npm install -D vitest @vitest/ui @vitest/coverage-v8
npm install -D @testing-library/react @testing-library/user-event
npm install -D msw                          # Mock Service Worker (API mocking)
npm install -D @playwright/test
npx playwright install chromium             # Headless browser
*/

// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'tests', '*.config.*', 'app/api/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

// tests/setup.ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## 2. Unit Tests

### 2.1 Matching Engine Tests

```typescript
// tests/unit/matching.test.ts

import { describe, it, expect } from 'vitest';
import { findBestMatch } from '@/lib/matching';

const ROWS = [
  { id: 'john_smith',   label: 'John Smith'   },
  { id: 'sarah_jones',  label: 'Sarah Jones'  },
  { id: 'mike_brown',   label: 'Mike Brown'   },
  { id: 'yossi_cohen',  label: 'Yossi Cohen'  },
  { id: 'anna_k',       label: 'Anna K'       },
];

describe('findBestMatch – exact match', () => {
  it('returns confidence 1.0 for exact case-insensitive match', () => {
    const result = findBestMatch('john smith', ROWS);
    expect(result?.rowId).toBe('john_smith');
    expect(result?.confidence).toBe(1.0);
    expect(result?.method).toBe('exact');
  });

  it('handles leading/trailing whitespace', () => {
    const result = findBestMatch('  Sarah Jones  ', ROWS);
    expect(result?.rowId).toBe('sarah_jones');
  });
});

describe('findBestMatch – phonetic match', () => {
  it('matches Yossi via Soundex for "yosi"', () => {
    const result = findBestMatch('yosi', ROWS);
    expect(result?.rowId).toBe('yossi_cohen');
    expect(result?.method).toBe('soundex');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('matches Mike for "Myke"', () => {
    const result = findBestMatch('myke brown', ROWS);
    expect(result?.rowId).toBe('mike_brown');
  });
});

describe('findBestMatch – Levenshtein', () => {
  it('matches "Micheal" to "Michael" (distance 1)', () => {
    const rows = [{ id: 'michael', label: 'Michael' }];
    const result = findBestMatch('Micheal', rows);
    expect(result?.rowId).toBe('michael');
    expect(result?.method).toBe('levenshtein');
  });

  it('returns null when distance > 2', () => {
    const result = findBestMatch('xyz123', ROWS);
    expect(result).toBeNull();
  });
});

describe('findBestMatch – ambiguity', () => {
  it('returns the higher-confidence match when two names are close', () => {
    const rows = [
      { id: 'jon_doe',   label: 'Jon Doe'   },
      { id: 'john_doe',  label: 'John Doe'  },
    ];
    const result = findBestMatch('john doe', rows);
    // Exact match should win
    expect(result?.rowId).toBe('john_doe');
    expect(result?.confidence).toBe(1.0);
  });
});
```

### 2.2 Value Parser Tests

```typescript
// tests/unit/value-parser.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseValue } from '@/lib/matching/value-parser';
import type { ColumnDefinition } from '@/lib/types';

const numberColumn: ColumnDefinition = {
  id: 'quiz_1',
  label: 'Quiz 1',
  type: 'number',
  validation: { min: 0, max: 100 },
};

const booleanColumn: ColumnDefinition = {
  id: 'present',
  label: 'Present',
  type: 'boolean',
};

const dateColumn: ColumnDefinition = {
  id: 'due_date',
  label: 'Due Date',
  type: 'date',
};

describe('parseValue – number', () => {
  it('parses numeric string', () => {
    expect(parseValue('85', numberColumn)).toEqual({ value: 85, valid: true });
  });

  it('converts word numbers', () => {
    expect(parseValue('eighty five', numberColumn)).toEqual({ value: 85, valid: true });
  });

  it('fails on value above max', () => {
    expect(parseValue('150', numberColumn)).toMatchObject({ valid: false });
  });

  it('fails on non-numeric string', () => {
    expect(parseValue('abc', numberColumn)).toMatchObject({ valid: false });
  });
});

describe('parseValue – boolean', () => {
  const truthy = ['yes', 'true', 'present', 'check', '1'];
  const falsy  = ['no', 'false', 'absent', 'uncheck', '0'];

  it.each(truthy)('maps "%s" → true', (input) => {
    expect(parseValue(input, booleanColumn)).toEqual({ value: true, valid: true });
  });

  it.each(falsy)('maps "%s" → false', (input) => {
    expect(parseValue(input, booleanColumn)).toEqual({ value: false, valid: true });
  });
});

describe('parseValue – date', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01'));
  });
  afterEach(() => vi.useRealTimers());

  it('parses "today" relative to system date', () => {
    const result = parseValue('today', dateColumn);
    expect(result.valid).toBe(true);
    expect(result.value).toBe('2025-03-01');
  });

  it('parses "march fifth"', () => {
    const result = parseValue('march fifth', dateColumn);
    expect(result.valid).toBe(true);
    expect(result.value).toBe('2025-03-05');
  });
});
```

### 2.3 Zustand Store Tests

```typescript
// tests/unit/ui-store.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUIStore } from '@/lib/stores/ui-store';
import type { TableSchema } from '@/lib/types';

// Reset store state between tests
beforeEach(() => {
  useUIStore.getState().reset();
});

const mockSchema: TableSchema = {
  columns: [
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'q1',   label: 'Quiz 1', type: 'number' },
    { id: 'q2',   label: 'Quiz 2', type: 'number' },
  ],
  rows: [
    { id: 'row_a', label: 'Alice' },
    { id: 'row_b', label: 'Bob' },
    { id: 'row_c', label: 'Carol' },
  ],
};

describe('setActiveCell', () => {
  it('updates activeCell in store', () => {
    const { result } = renderHook(() => useUIStore());

    act(() => result.current.setActiveCell({ rowId: 'row_a', columnId: 'q1' }));

    expect(result.current.activeCell).toEqual({ rowId: 'row_a', columnId: 'q1' });
  });
});

describe('startRecording / stopRecording', () => {
  it('transitions recording state correctly', () => {
    const { result } = renderHook(() => useUIStore());

    act(() => result.current.startRecording());
    expect(result.current.isRecording).toBe(true);
    expect(result.current.recordingState).toBe('listening');

    act(() => result.current.stopRecording());
    expect(result.current.isRecording).toBe(false);
    expect(result.current.recordingState).toBe('processing');
  });
});

describe('advancePointer – column-first', () => {
  it('moves down to next row in same column', () => {
    const { result } = renderHook(() => useUIStore());

    act(() => {
      result.current.setNavigationMode('column-first');
      result.current.setActiveCell({ rowId: 'row_a', columnId: 'q1' });
      result.current.advancePointer(mockSchema);
    });

    expect(result.current.activeCell).toEqual({ rowId: 'row_b', columnId: 'q1' });
  });

  it('wraps to next column at end of column', () => {
    const { result } = renderHook(() => useUIStore());

    act(() => {
      result.current.setNavigationMode('column-first');
      result.current.setActiveCell({ rowId: 'row_c', columnId: 'q1' });
      result.current.advancePointer(mockSchema);
    });

    expect(result.current.activeCell).toEqual({ rowId: 'row_a', columnId: 'q2' });
  });
});

describe('advancePointer – row-first', () => {
  it('moves right to next column in same row', () => {
    const { result } = renderHook(() => useUIStore());

    act(() => {
      result.current.setNavigationMode('row-first');
      result.current.setActiveCell({ rowId: 'row_a', columnId: 'q1' });
      result.current.advancePointer(mockSchema);
    });

    expect(result.current.activeCell).toEqual({ rowId: 'row_a', columnId: 'q2' });
  });
});

describe('cancelEntry', () => {
  it('resets pending confirmation and returns to idle', () => {
    const { result } = renderHook(() => useUIStore());

    act(() => {
      result.current.setPendingConfirmation({
        entity: 'Alice',
        value: 85,
        confidence: 0.9,
      });
    });

    expect(result.current.recordingState).toBe('confirming');

    act(() => result.current.cancelEntry());

    expect(result.current.pendingConfirmation).toBeNull();
    expect(result.current.recordingState).toBe('idle');
  });
});
```

---

## 3. Integration Tests

### 3.1 API Route Tests

```typescript
// tests/integration/api-tables.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// ⚠️  These tests run against a REAL Supabase test project.
//     Use a dedicated test database, never production.
//     Set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY in .env.test

const supabase = createClient(
  process.env.SUPABASE_TEST_URL!,
  process.env.SUPABASE_TEST_SERVICE_KEY!
);

const TEST_USER_ID = 'test-user-uuid'; // Seed via Supabase Auth admin API
let createdTableId: string;

describe('POST /api/tables', () => {
  it('creates a table and returns 201', async () => {
    const res = await fetch('http://localhost:3000/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sb-test-session=...' },
      body: JSON.stringify({
        name: 'Test Grades',
        schema: {
          columns: [
            { id: 'name', label: 'Name', type: 'text' },
            { id: 'q1',   label: 'Quiz 1', type: 'number', validation: { min: 0, max: 100 } },
          ],
          rows: [{ id: 'alice', label: 'Alice' }],
        },
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Test Grades');
    createdTableId = json.data.id;
  });
});

describe('PUT /api/tables/:id/data/cell', () => {
  it('upserts a cell value and returns 200', async () => {
    const res = await fetch(`http://localhost:3000/api/tables/${createdTableId}/data/cell`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: 'sb-test-session=...' },
      body: JSON.stringify({ row_id: 'alice', column_id: 'q1', value: 88 }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.value).toEqual({ v: 88 });
  });

  it('rejects a value outside min/max bounds', async () => {
    const res = await fetch(`http://localhost:3000/api/tables/${createdTableId}/data/cell`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: 'sb-test-session=...' },
      body: JSON.stringify({ row_id: 'alice', column_id: 'q1', value: 999 }),
    });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/tables/:id', () => {
  it('deletes the table and returns 200', async () => {
    const res = await fetch(`http://localhost:3000/api/tables/${createdTableId}`, {
      method: 'DELETE',
      headers: { Cookie: 'sb-test-session=...' },
    });

    expect(res.status).toBe(200);
  });
});
```

### 3.2 Database Integration Tests

```typescript
// tests/integration/db-rls.test.ts

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Test that RLS prevents cross-user data access

const userAClient = createClient(
  process.env.SUPABASE_TEST_URL!,
  process.env.SUPABASE_TEST_ANON_KEY!
);
const userBClient = createClient(
  process.env.SUPABASE_TEST_URL!,
  process.env.SUPABASE_TEST_ANON_KEY!
);

describe('Row Level Security', () => {
  let tableIdOwnedByA: string;

  it('User A can create and read their own table', async () => {
    // Sign in as User A (pre-seeded test account)
    await userAClient.auth.signInWithPassword({
      email: 'user-a@test.com',
      password: 'test-password-a',
    });

    const { data, error } = await userAClient.from('tables').insert({
      user_id: (await userAClient.auth.getUser()).data.user!.id,
      name: 'User A Table',
      schema: { columns: [], rows: [] },
    }).select().single();

    expect(error).toBeNull();
    tableIdOwnedByA = data!.id;
  });

  it('User B cannot read User A table', async () => {
    await userBClient.auth.signInWithPassword({
      email: 'user-b@test.com',
      password: 'test-password-b',
    });

    const { data } = await userBClient
      .from('tables')
      .select('*')
      .eq('id', tableIdOwnedByA);

    // RLS returns empty array, not an error, for unauthorized reads
    expect(data).toHaveLength(0);
  });

  it('User B cannot write to User A table_data', async () => {
    const { error } = await userBClient.from('table_data').insert({
      table_id: tableIdOwnedByA,
      row_id: 'hack',
      column_id: 'hack',
      value: { v: 'pwned' },
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501'); // RLS violation
  });
});
```

---

## 4. End-to-End Tests

### 4.1 Playwright Setup

```typescript
// playwright.config.ts

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4.2 Core User Journey

```typescript
// tests/e2e/core-journey.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Core User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in via Supabase magic link or test credentials
    await page.goto('/auth/sign-in');
    await page.fill('[data-testid="email"]', 'e2e@test.com');
    await page.fill('[data-testid="password"]', 'e2e-password');
    await page.click('[data-testid="sign-in-btn"]');
    await expect(page).toHaveURL('/');
  });

  test('creates a new table', async ({ page }) => {
    await page.click('[data-testid="create-table-btn"]');
    await page.fill('[data-testid="table-name-input"]', 'E2E Test Table');
    await page.click('[data-testid="add-column-btn"]');
    await page.fill('[data-testid="column-label-0"]', 'Quiz 1');
    await page.selectOption('[data-testid="column-type-0"]', 'number');
    await page.click('[data-testid="save-table-btn"]');

    await expect(page.getByText('E2E Test Table')).toBeVisible();
  });

  test('clicks a cell and highlights it', async ({ page }) => {
    await page.goto('/table/e2e-test-table-id');

    const cell = page.getByTestId('cell-row_a-q1');
    await cell.click();

    await expect(cell).toHaveClass(/outline-blue-400/);
  });

  test('exports table as CSV', async ({ page }) => {
    await page.goto('/table/e2e-test-table-id');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-csv-btn"]'),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('navigation mode toggle switches mode', async ({ page }) => {
    await page.goto('/table/e2e-test-table-id');

    await page.click('[data-testid="nav-mode-toggle"]');
    await expect(page.getByText('Row-first')).toBeVisible();
  });
});
```

### 4.3 Voice Pipeline E2E (Mocked)

```typescript
// tests/e2e/voice-pipeline.spec.ts
// NOTE: We mock the browser MediaRecorder and the API endpoints
// to avoid real microphone access and OpenAI costs in CI.

import { test, expect } from '@playwright/test';

test.describe('Voice Pipeline (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock MediaRecorder: immediately fires 'dataavailable' + 'stop'
    await page.addInitScript(() => {
      class MockMediaRecorder extends EventTarget {
        state = 'inactive';
        ondataavailable: ((e: any) => void) | null = null;
        onstop: (() => void) | null = null;

        start() {
          this.state = 'recording';
          setTimeout(() => {
            const blob = new Blob(['mock-audio'], { type: 'audio/webm' });
            this.ondataavailable?.({ data: blob });
          }, 50);
        }

        stop() {
          this.state = 'inactive';
          this.onstop?.();
        }

        static isTypeSupported() { return true; }
      }

      (window as any).MediaRecorder = MockMediaRecorder;
      (navigator.mediaDevices as any).getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
    });

    // Intercept /api/transcribe
    await page.route('/api/transcribe', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { transcript: 'Alice, 85', duration_ms: 1200, language_detected: 'en' },
        }),
      })
    );

    // Intercept /api/parse
    await page.route('/api/parse', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            action: 'UPDATE_CELL',
            entity: 'Alice',
            entityMatch: { original: 'Alice', matched: 'Alice', confidence: 1.0 },
            value: 85,
            valueValid: true,
            alternatives: [],
            reasoning: 'Exact match',
          },
        }),
      })
    );

    // Intercept /api/tables/:id/data/cell
    await page.route('**/data/cell', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'cell-1', row_id: 'alice', column_id: 'q1', value: { v: 85 } },
        }),
      })
    );

    await page.goto('/table/e2e-test-table-id');
  });

  test('full voice entry flow: record → confirm → cell updated', async ({ page }) => {
    // 1. Click a cell to set it as active
    await page.getByTestId('cell-alice-q1').click();

    // 2. Press (and hold) the record button
    await page.getByTestId('voice-record-btn').dispatchEvent('pointerdown');
    await page.waitForTimeout(100);
    await page.getByTestId('voice-record-btn').dispatchEvent('pointerup');

    // 3. Confirmation dialog should appear
    await expect(page.getByTestId('confirm-dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('85')).toBeVisible();

    // 4. Confirm entry
    await page.getByTestId('confirm-btn').click();

    // 5. Cell should display the value
    await expect(page.getByTestId('cell-alice-q1')).toContainText('85');
  });
});
```

---

## 5. Performance Tests

### 5.1 Latency Benchmarks

```typescript
// tests/perf/latency.bench.ts

import { bench, describe } from 'vitest';
import { findBestMatch } from '@/lib/matching';
import { distance } from 'fastest-levenshtein';

const LARGE_ROW_SET = Array.from({ length: 500 }, (_, i) => ({
  id: `row_${i}`,
  label: `Student ${i} Name`,
}));

describe('Matching performance at scale', () => {
  bench('findBestMatch on 500 rows (exact)', () => {
    findBestMatch('Student 250 Name', LARGE_ROW_SET);
  });

  bench('findBestMatch on 500 rows (levenshtein)', () => {
    findBestMatch('Studnt 250 Nane', LARGE_ROW_SET);
  });

  bench('Levenshtein distance (single pair)', () => {
    distance('John Smith', 'Jon Smith');
  });
});

// Target: findBestMatch on 500 rows < 10ms (P99)
// Run with: vitest bench
```

### 5.2 Rendering Performance

```typescript
// tests/perf/table-render.test.tsx

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DataTable } from '@/components/DataTable';
import type { TableSchema } from '@/lib/types';

function buildSchema(rowCount: number): TableSchema {
  return {
    columns: [
      { id: 'name', label: 'Name', type: 'text' },
      { id: 'q1', label: 'Quiz 1', type: 'number' },
      { id: 'q2', label: 'Quiz 2', type: 'number' },
    ],
    rows: Array.from({ length: rowCount }, (_, i) => ({
      id: `row_${i}`,
      label: `Student ${i}`,
    })),
  };
}

describe('DataTable render time', () => {
  it('renders 100 rows in < 200 ms', () => {
    const schema = buildSchema(100);
    const start = performance.now();

    render(<DataTable schema={schema} data={{}} />);

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('renders 500 rows in < 800 ms', () => {
    const schema = buildSchema(500);
    const start = performance.now();

    render(<DataTable schema={schema} data={{}} />);

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(800);
  });
});
```

---

## 6. Pre-Deploy Checklist

```typescript
// ═══════════════════════════════════════════════════════════
// PRE-DEPLOY CHECKLIST (run through every release)
// ═══════════════════════════════════════════════════════════

const preDeployChecklist = {
  code: [
    'npm run type-check              → 0 TypeScript errors',
    'npm run lint                    → 0 ESLint errors',
    'npm run test                    → All unit + integration tests pass',
    'npm run build                   → Production build succeeds',
  ],

  security: [
    'All .env secrets excluded from Git (.gitignore verified)',
    'SUPABASE_SERVICE_ROLE_KEY not exposed to client bundle',
    'RLS policies tested with two separate test accounts',
    'OpenAI key scoped to Usage Limits in dashboard',
    'npm audit → 0 critical vulnerabilities',
  ],

  functionality: [
    'Voice recording works in Chrome, Firefox, Safari',
    'End-to-end flow: record → parse → confirm → cell updated',
    'Fuzzy matching: "Jon Smith" → "John Smith" confirmed',
    'Optimistic rollback: disconnect network mid-mutation → rolls back',
    'CSV export downloads and opens correctly in Excel',
    'XLSX export downloads and opens correctly in Excel',
    'Delete table removes all associated data',
  ],

  performance: [
    'Lighthouse score ≥ 80 (Performance)',
    'Table with 100 rows renders < 200 ms',
    'Voice-to-result latency < 5 s on standard Wi-Fi',
    'No memory leaks (check DevTools Profiles tab after 10 voice entries)',
  ],

  ux: [
    'Error toast appears for all failure scenarios',
    'Empty state shown when no tables exist',
    'Loading spinners shown during all async operations',
    'Mobile layout renders correctly on 375px viewport',
    'Keyboard navigation works without a mouse',
  ],
};
```

---

## 7. Deployment Guide

### 7.1 Environment Variables

```bash
# .env.local (development) — never commit this file
# ─────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...

# Server-side only (not exposed to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJh...
OPENAI_API_KEY=sk-...

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```typescript
// lib/env.ts — Runtime validation (prevents silent misconfiguration)

import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:   z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  OPENAI_API_KEY:             z.string().startsWith('sk-'),
  SUPABASE_SERVICE_ROLE_KEY:  z.string().min(10).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Environment configuration error. Check .env.local');
}

export const env = parsed.data;
```

### 7.2 Supabase Production Setup

```sql
-- Run these in the Supabase SQL editor BEFORE first deploy
-- ──────────────────────────────────────────────────────────

-- 1. Enable real-time on table_data
ALTER PUBLICATION supabase_realtime ADD TABLE table_data;

-- 2. Verify RLS is ON
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tables', 'table_data');
-- Expected: rowsecurity = true for both

-- 3. Seed a test user (optional, for smoke testing after deploy)
-- Use Supabase Dashboard → Authentication → Add User

-- 4. Set up database webhook for future audit log (optional)
-- Supabase Dashboard → Database → Webhooks → Create new
```

```typescript
// Supabase project settings to configure in dashboard:
// ─────────────────────────────────────────────────────
// Auth → Site URL:           https://vocalgrid.vercel.app
// Auth → Redirect URLs:      https://vocalgrid.vercel.app/auth/callback
// Auth → Email:              Enable email confirmations (production)
// API → JWT Expiry:          3600 (1 hour, default)
// Storage → N/A              (not used in V1.0)
```

### 7.3 Vercel Deployment

```bash
# ─────────────────────────────────────────────
# STEP 1: Install Vercel CLI
# ─────────────────────────────────────────────
npm install -g vercel

# ─────────────────────────────────────────────
# STEP 2: Link project to Vercel
# ─────────────────────────────────────────────
vercel link
# Follow prompts: select team, project name, etc.

# ─────────────────────────────────────────────
# STEP 3: Set environment variables in Vercel
# ─────────────────────────────────────────────
vercel env add NEXT_PUBLIC_SUPABASE_URL        production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY   production
vercel env add SUPABASE_SERVICE_ROLE_KEY       production
vercel env add OPENAI_API_KEY                  production

# ─────────────────────────────────────────────
# STEP 4: Deploy
# ─────────────────────────────────────────────
vercel --prod

# ─────────────────────────────────────────────
# STEP 5: Set custom domain (optional)
# ─────────────────────────────────────────────
# Vercel Dashboard → Project → Domains → Add domain
# Add CNAME record pointing to cname.vercel-dns.com in your DNS provider
```

```typescript
// vercel.json  (optional tuning)
/*
{
  "functions": {
    "app/api/transcribe/route.ts": {
      "maxDuration": 30
    },
    "app/api/parse/route.ts": {
      "maxDuration": 15
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options",        "value": "DENY"    }
      ]
    }
  ]
}
*/
```

### 7.4 Post-Deploy Verification

```typescript
// tests/smoke/smoke.test.ts
// Run after every production deploy: npm run test:smoke

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.SMOKE_TEST_URL ?? 'https://vocalgrid.vercel.app';

describe('Production smoke tests', () => {
  it('homepage returns 200', async () => {
    const res = await fetch(BASE_URL);
    expect(res.status).toBe(200);
  });

  it('/api/tables returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/tables`);
    expect(res.status).toBe(401);
  });

  it('/api/parse returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('exports endpoint returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/tables/fake-id/export/csv`);
    expect(res.status).toBe(401);
  });
});
```

---

## 8. Monitoring & Observability

### 8.1 Error Tracking

```typescript
// lib/monitoring/errors.ts
// Lightweight error reporter — swap for Sentry in production

interface ErrorReport {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  url: string;
}

export function reportError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): void {
  const report: ErrorReport = {
    code,
    message,
    context,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'server',
  };

  // Development: log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('[VocalGrid Error]', report);
    return;
  }

  // Production: send to logging endpoint (replace with Sentry/Datadog)
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
    keepalive: true, // survives page unload
  }).catch(() => {}); // fire-and-forget
}

// Usage example in API routes:
// reportError('STT_TIMEOUT', 'Whisper took > 30s', { audioSizeBytes: blob.size });
```

### 8.2 Performance Monitoring

```typescript
// lib/monitoring/perf.ts

export interface VoiceEntryMetrics {
  transcribe_ms: number;
  parse_ms: number;
  total_ms: number;
  confidence: number;
  success: boolean;
  error_code?: string;
}

export function trackVoiceEntry(metrics: VoiceEntryMetrics): void {
  // Vercel Analytics custom event
  if (typeof window !== 'undefined' && (window as any).va) {
    (window as any).va('event', 'voice_entry', {
      ...metrics,
      // Vercel Analytics only accepts string/number values
      success: metrics.success ? 1 : 0,
    });
  }

  // Log slow entries for investigation
  if (metrics.total_ms > 8000) {
    reportError('HIGH_LATENCY', `Voice entry took ${metrics.total_ms}ms`, metrics);
  }
}

// Usage in VoiceRecorder flow:
/*
  const t0 = Date.now();
  const transcript = await transcribeAudio(blob);
  const t1 = Date.now();

  const parseResult = await parseTranscript(transcript.transcript, ...);
  const t2 = Date.now();

  trackVoiceEntry({
    transcribe_ms: t1 - t0,
    parse_ms:      t2 - t1,
    total_ms:      t2 - t0,
    confidence:    parseResult.entityMatch.confidence,
    success:       parseResult.action === 'UPDATE_CELL',
  });
*/
```

### 8.3 Cost Monitoring

```typescript
// lib/monitoring/cost.ts
// Track estimated API costs per user session

const COST_PER_MINUTE_WHISPER = 0.006;   // USD
const COST_PER_1K_TOKENS_GPT  = 0.000150; // GPT-4o-mini input

export function estimateCost(
  audioMinutes: number,
  llmInputTokens: number
): { whisperUSD: number; gptUSD: number; totalUSD: number } {
  const whisperUSD = audioMinutes * COST_PER_MINUTE_WHISPER;
  const gptUSD = (llmInputTokens / 1000) * COST_PER_1K_TOKENS_GPT;
  const totalUSD = whisperUSD + gptUSD;

  return { whisperUSD, gptUSD, totalUSD };
}

// Alert thresholds (configure in OpenAI dashboard):
// Hard limit:  $20 / month
// Soft limit:  $10 / month → email alert
//
// Monitor at: platform.openai.com/usage
```

---

*End of Testing & Deployment Documentation*
