# VocalGrid - Performance Optimization

**Chapter:** 10  
**Dependencies:** 02_ARCHITECTURE.md, 05_VOICE_PIPELINE.md  
**Related:** 03_DATABASE.md, 04_STATE_MANAGEMENT.md

---

## Table of Contents

1. [Performance Philosophy](#1-performance-philosophy)
   - 1.1 [Core Principles](#11-core-principles)
   - 1.2 [Performance Budgets](#12-performance-budgets)

2. [Frontend Performance](#2-frontend-performance)
   - 2.1 [Code Splitting](#21-code-splitting)
   - 2.2 [Bundle Optimization](#22-bundle-optimization)
   - 2.3 [Image Optimization](#23-image-optimization)
   - 2.4 [Font Optimization](#24-font-optimization)

3. [React Performance](#3-react-performance)
   - 3.1 [Component Optimization](#31-component-optimization)
   - 3.2 [State Management Performance](#32-state-management-performance)
   - 3.3 [Render Optimization](#33-render-optimization)
   - 3.4 [Virtualization](#34-virtualization)

4. [API Performance](#4-api-performance)
   - 4.1 [Response Caching](#41-response-caching)
   - 4.2 [Request Optimization](#42-request-optimization)
   - 4.3 [Parallel Processing](#43-parallel-processing)
   - 4.4 [Edge Functions](#44-edge-functions)

5. [Database Performance](#5-database-performance)
   - 5.1 [Query Optimization](#51-query-optimization)
   - 5.2 [Indexing Strategy](#52-indexing-strategy)
   - 5.3 [Connection Pooling](#53-connection-pooling)
   - 5.4 [Data Pagination](#54-data-pagination)

6. [Voice Pipeline Performance](#6-voice-pipeline-performance)
   - 6.1 [Audio Compression](#61-audio-compression)
   - 6.2 [Streaming vs Batch](#62-streaming-vs-batch)
   - 6.3 [Caching Strategies](#63-caching-strategies)

7. [Network Performance](#7-network-performance)
   - 7.1 [CDN Configuration](#71-cdn-configuration)
   - 7.2 [HTTP/2 & HTTP/3](#72-http2--http3)
   - 7.3 [Compression](#73-compression)
   - 7.4 [Prefetching & Preloading](#74-prefetching--preloading)

8. [Monitoring & Metrics](#8-monitoring--metrics)
   - 8.1 [Core Web Vitals](#81-core-web-vitals)
   - 8.2 [Custom Metrics](#82-custom-metrics)
   - 8.3 [Real User Monitoring](#83-real-user-monitoring)
   - 8.4 [Performance Budgets Tracking](#84-performance-budgets-tracking)

9. [Mobile Performance](#9-mobile-performance)
   - 9.1 [Mobile-Specific Optimizations](#91-mobile-specific-optimizations)
   - 9.2 [Network Optimization](#92-network-optimization)
   - 9.3 [Battery Optimization](#93-battery-optimization)

10. [Performance Checklist](#10-performance-checklist)

---

## 1. Performance Philosophy

### 1.1 Core Principles

**User-Centric Performance:**
- Optimize for perceived performance, not just raw metrics
- Prioritize critical rendering path
- Progressive enhancement over feature bloat

**Measure, Don't Guess:**
- Always measure before optimizing
- Use real user data, not just lab tests
- Track performance over time

**Performance as a Feature:**
- Performance is not an afterthought
- Budget performance from the start
- Regression testing for performance

### 1.2 Performance Budgets
```typescript
// performance-budgets.ts

export const PerformanceBudgets = {
  // Page Load Performance
  pageLoad: {
    FCP: 1800,        // First Contentful Paint (ms)
    LCP: 2500,        // Largest Contentful Paint (ms)
    TTI: 3800,        // Time to Interactive (ms)
    TBT: 300,         // Total Blocking Time (ms)
    CLS: 0.1,         // Cumulative Layout Shift (score)
  },

  // Voice Pipeline Performance
  voicePipeline: {
    audioUpload: 500,           // Audio upload time (ms)
    whisperAPI: 2000,           // Whisper transcription (ms)
    gptParsing: 1000,           // GPT parsing (ms)
    totalE2E: 3500,             // End-to-end latency (ms)
  },

  // Bundle Size Budgets
  bundleSize: {
    initialJS: 200,             // Initial JS bundle (KB)
    totalJS: 500,               // Total JS (KB)
    CSS: 50,                    // CSS (KB)
    fonts: 100,                 // Web fonts (KB)
    images: 200,                // Images per page (KB)
  },

  // Database Performance
  database: {
    queryTime: 200,             // Query execution (ms)
    fetchTableData: 500,        // Fetch table + data (ms)
    mutation: 300,              // Insert/update (ms)
  },

  // Network Performance
  network: {
    TTFB: 600,                  // Time to First Byte (ms)
    apiResponse: 1000,          // API response time (ms)
    imageLoad: 2000,            // Image load time (ms)
  },
};

// Validation function
export function validatePerformance(
  metric: string,
  value: number,
  category: keyof typeof PerformanceBudgets
): { passed: boolean; budget: number; actual: number } {
  const budget = (PerformanceBudgets[category] as any)[metric];
  
  return {
    passed: value <= budget,
    budget,
    actual: value,
  };
}
```

---

## 2. Frontend Performance

### 2.1 Code Splitting
```typescript
// app/layout.tsx

import dynamic from 'next/dynamic';

// Lazy load components that aren't needed immediately
const VoiceButton = dynamic(() => import('@/components/VoiceButton'), {
  loading: () => <div>Loading voice controls...</div>,
  ssr: false, // Don't render on server (uses browser APIs)
});

const ConfirmationDialog = dynamic(
  () => import('@/components/ConfirmationDialog'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Route-based code splitting (automatic in Next.js)
// Each page in app/ is automatically code-split

// Component-level code splitting
export default function TablePage() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div>
      <DataTable />
      <VoiceButton />
      
      {showAdvanced && (
        <Suspense fallback={<div>Loading...</div>}>
          <AdvancedSettings />
        </Suspense>
      )}
    </div>
  );
}
```

### 2.2 Bundle Optimization
```javascript
// next.config.js

const nextConfig = {
  // Optimize bundle
  swcMinify: true,
  
  // Remove unused code
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
    ],
  },

  // Bundle analyzer (development only)
  webpack: (config, { isServer }) => {
    if (!isServer && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: true,
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;

// Run bundle analyzer:
// ANALYZE=true npm run build
```

### 2.3 Image Optimization
```typescript
// components/OptimizedImage.tsx

import Image from 'next/image';

export function OptimizedImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      quality={75}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Low-quality placeholder
    />
  );
}

// Optimize static images at build time
import logo from '@/public/logo.png';

<Image src={logo} alt="Logo" placeholder="blur" />
```

### 2.4 Font Optimization
```typescript
// app/layout.tsx

import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',              // Use fallback while loading
  preload: true,                // Preload font
  variable: '--font-inter',     // CSS variable
  weight: ['400', '500', '600', '700'], // Only weights used
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

// CSS
// font-family: var(--font-inter), system-ui, sans-serif;
```

---

## 3. React Performance

### 3.1 Component Optimization
```typescript
// components/DataTable.tsx

import { memo, useMemo } from 'react';

// Memoize component to prevent unnecessary re-renders
export const DataTable = memo(function DataTable({
  schema,
  data,
}: DataTableProps) {
  // Memoize expensive computations
  const gridData = useMemo(() => {
    return transformDataToGrid(data);
  }, [data]);

  const sortedRows = useMemo(() => {
    return schema.rows.slice().sort((a, b) => 
      a.label.localeCompare(b.label)
    );
  }, [schema.rows]);

  return (
    <table>
      {/* Render */}
    </table>
  );
});

// Custom comparison function for memo
export const TableCell = memo(
  function TableCell({ rowId, columnId, value }: TableCellProps) {
    return <td>{value}</td>;
  },
  (prevProps, nextProps) => {
    // Only re-render if value changed
    return prevProps.value === nextProps.value &&
           prevProps.rowId === nextProps.rowId &&
           prevProps.columnId === nextProps.columnId;
  }
);
```

### 3.2 State Management Performance
```typescript
// lib/stores/ui-store.ts

import { create } from 'zustand';

// Use selective subscriptions to prevent unnecessary re-renders
export const useUIStore = create<UIStore>((set) => ({
  activeCell: null,
  isRecording: false,
  // ... other state
}));

// ❌ BAD: Subscribes to entire store
function Component() {
  const store = useUIStore();
  return <div>{store.activeCell}</div>;
}

// ✅ GOOD: Only subscribes to activeCell
function Component() {
  const activeCell = useUIStore((state) => state.activeCell);
  return <div>{activeCell}</div>;
}

// ✅ BETTER: Use shallow equality for objects
import { shallow } from 'zustand/shallow';

function Component() {
  const { activeCell, navigationMode } = useUIStore(
    (state) => ({ activeCell: state.activeCell, navigationMode: state.navigationMode }),
    shallow
  );
}
```

### 3.3 Render Optimization
```typescript
// hooks/use-debounced-value.ts

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage: Debounce search input
function SearchTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  // Only triggers expensive search after 300ms of no typing
  const results = useSearchResults(debouncedSearchTerm);

  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );
}
```

### 3.4 Virtualization
```typescript
// components/VirtualizedTable.tsx

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function VirtualizedTable({ rows, columns }: VirtualizedTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Only render visible rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Row height in pixels
    overscan: 5, // Render 5 extra rows above/below viewport
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* Render row */}
              <TableRow row={row} columns={columns} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Benefit: Renders only ~20 rows instead of 1000+
// Performance improvement: 50x faster initial render
```

---

## 4. API Performance

### 4.1 Response Caching
```typescript
// app/api/tables/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const table = await fetchTable(params.id);

  return NextResponse.json(table, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      // Cache for 5 minutes, serve stale for 10 minutes while revalidating
    },
  });
}

// Client-side caching with TanStack Query
const { data } = useQuery({
  queryKey: ['table', tableId],
  queryFn: () => fetchTable(tableId),
  staleTime: 1000 * 60 * 5,      // Consider fresh for 5 minutes
  cacheTime: 1000 * 60 * 30,     // Keep in cache for 30 minutes
});
```

### 4.2 Request Optimization
```typescript
// lib/api/batch-requests.ts

interface BatchRequest {
  endpoint: string;
  params: any;
}

/**
 * Batch multiple API requests into one
 */
export async function batchRequests(requests: BatchRequest[]) {
  const response = await fetch('/api/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });

  return response.json();
}

// Usage: Fetch table + data in one request
const results = await batchRequests([
  { endpoint: '/api/tables/123', params: {} },
  { endpoint: '/api/table-data/123', params: {} },
]);

// Server implementation
export async function POST(req: NextRequest) {
  const { requests } = await req.json();

  const results = await Promise.all(
    requests.map(async (req: BatchRequest) => {
      // Handle each request
      const data = await handleRequest(req.endpoint, req.params);
      return { endpoint: req.endpoint, data };
    })
  );

  return NextResponse.json({ results });
}
```

### 4.3 Parallel Processing
```typescript
// app/api/voice-input/route.ts

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioFile = formData.get('audio') as File;
  const context = JSON.parse(formData.get('context') as string);

  // Process transcription and prepare parsing context in parallel
  const [transcription, parsingContext] = await Promise.all([
    // Transcription (slowest)
    openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    }),
    
    // Prepare context (fast)
    prepareParsingContext(context),
  ]);

  // Then parse (sequential dependency)
  const parsed = await parseTranscript(transcription.text, parsingContext);

  return NextResponse.json({
    transcript: transcription.text,
    parsed,
  });
}

// Savings: ~200-500ms by parallelizing independent operations
```

### 4.4 Edge Functions
```typescript
// app/api/transcribe/route.ts

// Use edge runtime for lower latency
export const runtime = 'edge';

export async function POST(req: Request) {
  // Runs on edge locations close to users
  // Lower cold start time (~50ms vs ~500ms for Node.js)
  
  const formData = await req.formData();
  // ... processing
}

// When to use edge:
// ✅ Simple API routes (JSON transformation, proxying)
// ✅ Geography-dependent responses
// ❌ Heavy computation
// ❌ Large dependencies (Node.js libraries)
```

---

## 5. Database Performance

### 5.1 Query Optimization
```sql
-- ═══════════════════════════════════════════════════════════
-- SLOW QUERY (Sequential scan)
-- ═══════════════════════════════════════════════════════════
SELECT * FROM table_data WHERE table_id = 'abc-123';
-- Execution time: ~500ms for 10,000 rows

-- ═══════════════════════════════════════════════════════════
-- OPTIMIZED QUERY (Index scan)
-- ═══════════════════════════════════════════════════════════
-- With index on table_id
CREATE INDEX idx_table_data_table_id ON table_data(table_id);

SELECT * FROM table_data WHERE table_id = 'abc-123';
-- Execution time: ~50ms for 10,000 rows (10x faster)

-- ═══════════════════════════════════════════════════════════
-- FURTHER OPTIMIZATION (Covering index)
-- ═══════════════════════════════════════════════════════════
CREATE INDEX idx_table_data_covering 
  ON table_data(table_id) 
  INCLUDE (row_id, column_id, value);

-- Query can be satisfied from index alone (no table lookup)
-- Execution time: ~20ms (25x faster than original)
```

### 5.2 Indexing Strategy
```sql
-- ═══════════════════════════════════════════════════════════
-- PRIMARY INDEXES
-- ═══════════════════════════════════════════════════════════

-- Fast lookup by table
CREATE INDEX idx_table_data_table_id ON table_data(table_id);

-- Fast lookup by row (for fetching all columns of a row)
CREATE INDEX idx_table_data_row ON table_data(table_id, row_id);

-- Fast lookup by column (for column-wise operations)
CREATE INDEX idx_table_data_column ON table_data(table_id, column_id);

-- ═══════════════════════════════════════════════════════════
-- COMPOSITE INDEX (Most selective)
-- ═══════════════════════════════════════════════════════════

-- For unique cell lookup
CREATE UNIQUE INDEX idx_table_data_cell 
  ON table_data(table_id, row_id, column_id);

-- ═══════════════════════════════════════════════════════════
-- PARTIAL INDEX (For common filters)
-- ═══════════════════════════════════════════════════════════

-- Only index recent data
CREATE INDEX idx_table_data_recent 
  ON table_data(table_id, created_at)
  WHERE created_at > NOW() - INTERVAL '30 days';

-- Smaller index, faster queries for recent data
```

### 5.3 Connection Pooling
```typescript
// lib/database/connection-pool.ts

import { createClient } from '@supabase/supabase-js';

// Supabase handles connection pooling automatically via PgBouncer
// Configuration is done in Supabase dashboard

// For direct PostgreSQL connections:
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,                    // Maximum pool size
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout if no connection available
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (duration > 200) {
    console.warn('Slow query detected:', { text, duration });
  }
  
  return res;
}
```

### 5.4 Data Pagination
```typescript
// lib/pagination/cursor-based.ts

interface PaginationParams {
  limit: number;
  cursor?: string; // Encoded timestamp or ID
}

export async function fetchPaginatedData({
  tableId,
  limit = 50,
  cursor,
}: PaginationParams & { tableId: string }) {
  let query = supabase
    .from('table_data')
    .select('*')
    .eq('table_id', tableId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Cursor-based pagination (more efficient than offset)
  if (cursor) {
    const decodedCursor = atob(cursor);
    query = query.lt('created_at', decodedCursor);
  }

  const { data, error } = await query;

  if (error) throw error;

  const nextCursor = data.length === limit
    ? btoa(data[data.length - 1].created_at)
    : null;

  return {
    data,
    nextCursor,
    hasMore: !!nextCursor,
  };
}

// Usage with infinite scroll
const {
  data,
  fetchNextPage,
  hasNextPage,
} = useInfiniteQuery({
  queryKey: ['table-data', tableId],
  queryFn: ({ pageParam = undefined }) =>
    fetchPaginatedData({ tableId, cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

---

## 6. Voice Pipeline Performance

### 6.1 Audio Compression
```typescript
// lib/audio/compression.ts

export async function compressAudio(audioBlob: Blob): Promise<Blob> {
  // WebM with Opus codec is already well-compressed
  // For additional compression:
  
  const audioContext = new AudioContext({
    sampleRate: 16000, // Downsample to 16kHz (Whisper optimal)
  });
  
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Mono conversion (if stereo)
  const channelData = audioBuffer.getChannelData(0);
  
  // Convert to 16-bit PCM (smaller than float32)
  const int16Array = new Int16Array(channelData.length);
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  
  // Create WAV blob
  const wavBlob = createWavBlob(int16Array, audioBuffer.sampleRate);
  
  return wavBlob;
}

// Typical compression: 1MB → 200KB (5x reduction)
```

### 6.2 Streaming vs Batch
```typescript
// lib/voice/streaming-stt.ts

/**
 * Streaming STT (future enhancement)
 * Whisper doesn't support streaming, but Deepgram/AssemblyAI do
 */
export async function* streamTranscription(
  audioStream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const ws = new WebSocket('wss://api.deepgram.com/v1/listen');
  
  // Send audio chunks
  const reader = audioStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    ws.send(value);
  }
  
  // Receive transcription chunks
  for await (const message of websocketMessages(ws)) {
    yield message.transcript;
  }
}

// Perceived latency: ~500ms (vs 2000ms for batch)
// Cost trade-off: ~2x more expensive
```

### 6.3 Caching Strategies
```typescript
// lib/cache/transcription-cache.ts

import { LRUCache } from 'lru-cache';

// Cache transcriptions by audio hash
const transcriptionCache = new LRUCache<string, string>({
  max: 100,                   // Cache up to 100 transcriptions
  ttl: 1000 * 60 * 60,        // 1 hour TTL
  maxSize: 1024 * 1024 * 10,  // 10MB max cache size
  sizeCalculation: (value) => value.length,
});

async function getAudioHash(audioBlob: Blob): Promise<string> {
  const buffer = await audioBlob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function transcribeWithCache(audioBlob: Blob): Promise<string> {
  const hash = await getAudioHash(audioBlob);
  
  // Check cache
  const cached = transcriptionCache.get(hash);
  if (cached) {
    console.log('Cache hit for transcription');
    return cached;
  }
  
  // Transcribe
  const transcript = await transcribe(audioBlob);
  
  // Store in cache
  transcriptionCache.set(hash, transcript);
  
  return transcript;
}

// Cache hit rate: ~20-30% (common phrases)
// Savings: ~2 seconds per cache hit
```

---

## 7. Network Performance

### 7.1 CDN Configuration
```javascript
// next.config.js

module.exports = {
  images: {
    // Use Vercel's Image Optimization CDN
    domains: ['vocalgrid.com'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Enable static asset CDN
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? 'https://cdn.vocalgrid.com'
    : '',
};

// Vercel automatically serves:
// - All static files from edge CDN
// - Next.js pages from edge cache
// - API routes from nearest edge location
```

### 7.2 HTTP/2 & HTTP/3
```typescript
// Vercel automatically enables HTTP/2 and HTTP/3
// No configuration needed

// Benefits:
// - Multiplexing: Multiple requests over single connection
// - Header compression: Reduced overhead
// - Server push: Preemptively send resources
// - HTTP/3: QUIC protocol, better mobile performance

// To verify:
// curl -I --http2 https://vocalgrid.com
// curl -I --http3 https://vocalgrid.com
```

### 7.3 Compression
```javascript
// next.config.js

module.exports = {
  compress: true, // Enable gzip compression
  
  // Vercel automatically uses Brotli compression (better than gzip)
  // Text compression ratio: ~70% reduction
  // Example: 200KB JS → 60KB compressed
};

// Manual compression for API responses:
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

export async function GET() {
  const data = { /* large JSON */ };
  const json = JSON.stringify(data);
  const compressed = await gzipAsync(json);
  
  return new Response(compressed, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
    },
  });
}
```

### 7.4 Prefetching & Preloading
```typescript
// app/page.tsx

import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      {/* Next.js automatically prefetches on hover */}
      <Link href="/table/123" prefetch={true}>
        Open Table
      </Link>
      
      {/* Manual prefetch */}
      <button
        onMouseEnter={() => {
          // Prefetch when user hovers
          import('@/components/HeavyComponent');
        }}
      >
        Show Advanced
      </button>
    </div>
  );
}

// Preload critical resources
export default function RootLayout() {
  return (
    <html>
      <head>
        {/* Preload critical font */}
        <link
          rel="preload"
          href="/fonts/inter.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        
        {/* Preconnect to external APIs */}
        <link rel="preconnect" href="https://api.openai.com" />
        <link rel="dns-prefetch" href="https://api.openai.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## 8. Monitoring & Metrics

### 8.1 Core Web Vitals
```typescript
// lib/analytics/web-vitals.ts

import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

export function reportWebVitals() {
  onCLS((metric) => {
    console.log('CLS:', metric.value);
    sendToAnalytics('CLS', metric.value);
  });

  onFID((metric) => {
    console.log('FID:', metric.value);
    sendToAnalytics('FID', metric.value);
  });

  onFCP((metric) => {
    console.log('FCP:', metric.value);
    sendToAnalytics('FCP', metric.value);
  });

  onLCP((metric) => {
    console.log('LCP:', metric.value);
    sendToAnalytics('LCP', metric.value);
  });

  onTTFB((metric) => {
    console.log('TTFB:', metric.value);
    sendToAnalytics('TTFB', metric.value);
  });
}

function sendToAnalytics(metric: string, value: number) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', metric, {
      value: Math.round(value),
      event_category: 'Web Vitals',
      non_interaction: true,
    });
  }
}

// Usage in _app.tsx or layout.tsx
useEffect(() => {
  reportWebVitals();
}, []);
```

### 8.2 Custom Metrics
```typescript
// lib/analytics/custom-metrics.ts

export class PerformanceMonitor {
  private static marks = new Map<string, number>();

  static mark(name: string) {
    this.marks.set(name, performance.now());
  }

  static measure(name: string, startMark: string): number {
    const startTime = this.marks.get(startMark);
    if (!startTime) {
      console.warn(`No mark found for ${startMark}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(startMark);

    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    
    // Send to analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'timing_complete', {
        name,
        value: Math.round(duration),
        event_category: 'Performance',
      });
    }

    return duration;
  }
}

// Usage:
PerformanceMonitor.mark('voice-input-start');
// ... voice input processing
PerformanceMonitor.measure('Voice Input E2E', 'voice-input-start');
```

### 8.3 Real User Monitoring
```typescript
// lib/monitoring/rum.ts

export class RealUserMonitoring {
  static trackPageLoad() {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      const metrics = {
        dns: perfData.domainLookupEnd - perfData.domainLookupStart,
        tcp: perfData.connectEnd - perfData.connectStart,
        request: perfData.responseStart - perfData.requestStart,
        response: perfData.responseEnd - perfData.responseStart,
        dom: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        load: perfData.loadEventEnd - perfData.loadEventStart,
        total: perfData.loadEventEnd - perfData.fetchStart,
      };

      console.log('Page Load Metrics:', metrics);
      
      // Send to analytics
      Object.entries(metrics).forEach(([key, value]) => {
        sendToAnalytics(`page_load_${key}`, value);
      });
    });
  }

  static trackAPICall(endpoint: string, duration: number, success: boolean) {
    sendToAnalytics('api_call', duration, {
      endpoint,
      success,
    });
  }
}
```

### 8.4 Performance Budgets Tracking
```typescript
// lib/monitoring/budget-tracker.ts

import { PerformanceBudgets, validatePerformance } from './performance-budgets';

export class BudgetTracker {
  private violations: Array<{
    metric: string;
    budget: number;
    actual: number;
    timestamp: Date;
  }> = [];

  track(metric: string, value: number, category: keyof typeof PerformanceBudgets) {
    const result = validatePerformance(metric, value, category);

    if (!result.passed) {
      console.warn(
        `⚠️ Performance budget violation: ${metric}`,
        `Budget: ${result.budget}ms, Actual: ${result.actual}ms`
      );

      this.violations.push({
        metric,
        budget: result.budget,
        actual: result.actual,
        timestamp: new Date(),
      });

      // Send alert if in production
      if (process.env.NODE_ENV === 'production') {
        this.sendAlert(metric, result);
      }
    }

    return result;
  }

  getViolations() {
    return [...this.violations];
  }

  private sendAlert(metric: string, result: any) {
    // Send to monitoring service (Datadog, New Relic, etc.)
    console.error('Performance budget exceeded:', { metric, result });
  }
}

export const budgetTracker = new BudgetTracker();

// Usage:
const duration = Date.now() - startTime;
budgetTracker.track('whisperAPI', duration, 'voicePipeline');
```

---

## 9. Mobile Performance

### 9.1 Mobile-Specific Optimizations
```typescript
// lib/mobile/optimizations.ts

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function getMobileOptimizations() {
  const mobile = isMobile();

  return {
    // Reduce image quality on mobile
    imageQuality: mobile ? 60 : 75,
    
    // Smaller batch sizes on mobile
    tableBatchSize: mobile ? 25 : 50,
    
    // More aggressive lazy loading
    lazyLoadThreshold: mobile ? '50px' : '200px',
    
    // Disable animations on low-end devices
    reduceMotion: mobile && !window.matchMedia('(prefers-reduced-motion: no-preference)').matches,
  };
}

// Usage:
const opts = getMobileOptimizations();

<Image
  src={src}
  quality={opts.imageQuality}
  loading="lazy"
/>
```

### 9.2 Network Optimization
```typescript
// lib/mobile/network-aware.ts

export function getNetworkSpeed(): 'slow' | 'medium' | 'fast' {
  if (typeof navigator === 'undefined' || !(navigator as any).connection) {
    return 'medium';
  }

  const conn = (navigator as any).connection;
  const effectiveType = conn.effectiveType;

  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'slow';
  } else if (effectiveType === '3g') {
    return 'medium';
  } else {
    return 'fast';
  }
}

export function shouldUseFeature(feature: string): boolean {
  const speed = getNetworkSpeed();

  const features = {
    'high-quality-images': speed !== 'slow',
    'auto-voice-transcription': speed === 'fast',
    'real-time-updates': speed !== 'slow',
    'prefetching': speed === 'fast',
  };

  return features[feature as keyof typeof features] ?? true;
}

// Usage:
if (shouldUseFeature('auto-voice-transcription')) {
  // Enable auto-transcription
} else {
  // Show manual transcription button
}
```

### 9.3 Battery Optimization
```typescript
// lib/mobile/battery-aware.ts

export async function getBatteryStatus() {
  if (typeof navigator === 'undefined' || !(navigator as any).getBattery) {
    return { level: 1, charging: true };
  }

  const battery = await (navigator as any).getBattery();
  return {
    level: battery.level,
    charging: battery.charging,
  };
}

export async function shouldReduceUsage(): Promise<boolean> {
  const battery = await getBatteryStatus();
  
  // Reduce usage if battery low and not charging
  return battery.level < 0.2 && !battery.charging;
}

// Usage:
const reduceBattery = await shouldReduceUsage();

if (reduceBattery) {
  // Disable background polling
  // Reduce animation frequency
  // Disable auto-save
}
```

---

## 10. Performance Checklist

**Frontend:**
- [ ] Code splitting implemented
- [ ] Bundle size under budget (< 500KB)
- [ ] Images optimized (WebP/AVIF)
- [ ] Fonts optimized (subset, preload)
- [ ] Lazy loading for non-critical components

**React:**
- [ ] Components memoized where appropriate
- [ ] Selective state subscriptions (Zustand)
- [ ] Expensive computations memoized (useMemo)
- [ ] Virtualization for large lists

**API:**
- [ ] Response caching configured
- [ ] Parallel processing where possible
- [ ] Edge functions for simple routes
- [ ] Batch requests for related data

**Database:**
- [ ] Indexes on frequently queried columns
- [ ] Covering indexes for common queries
- [ ] Connection pooling enabled
- [ ] Pagination for large datasets

**Voice Pipeline:**
- [ ] Audio compression implemented
- [ ] Transcription caching
- [ ] Optimal audio format (WebM/Opus)

**Network:**
- [ ] CDN configured (Vercel)
- [ ] Compression enabled (Brotli)
- [ ] Prefetching for critical resources
- [ ] HTTP/2 enabled

**Monitoring:**
- [ ] Core Web Vitals tracked
- [ ] Custom metrics implemented
- [ ] Performance budgets enforced
- [ ] Real User Monitoring enabled

**Mobile:**
- [ ] Mobile-specific optimizations
- [ ] Network-aware features
- [ ] Battery-conscious behavior

---

*End of Performance Documentation*