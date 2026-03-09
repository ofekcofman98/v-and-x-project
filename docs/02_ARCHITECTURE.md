# VocalGrid - System Architecture

**Chapter:** 02  
**Dependencies:** 01_OVERVIEW.md  
**Related:** 03_DATABASE.md, 04_STATE_MANAGEMENT.md, 05_VOICE_PIPELINE.md

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
   - 1.1 [System Context Diagram](#11-system-context-diagram)
   - 1.2 [High-Level Architecture](#12-high-level-architecture)

2. [Technology Stack Decisions](#2-technology-stack-decisions)
   - 2.1 [Frontend](#21-frontend)
   - 2.2 [State Management](#22-state-management)
   - 2.3 [Backend](#23-backend)
   - 2.4 [Database](#24-database)
   - 2.5 [AI Services](#25-ai-services)
   - 2.6 [Deployment](#26-deployment)

3. [Data Flow Diagrams](#3-data-flow-diagrams)
   - 3.1 [Voice Input Flow (Detailed)](#31-voice-input-flow-detailed)
   - 3.2 [Table Load Flow](#32-table-load-flow)

4. [Security Architecture](#4-security-architecture)
   - 4.1 [Authentication Flow](#41-authentication-flow)
   - 4.2 [Row Level Security (RLS)](#42-row-level-security-rls)
   - 4.3 [API Security](#43-api-security)

5. [Scalability Considerations](#5-scalability-considerations)
   - 5.1 [Performance Optimization](#51-performance-optimization)
   - 5.2 [Future Scaling Path](#52-future-scaling-path)

6. [Monitoring & Observability](#6-monitoring--observability)
   - 6.1 [Logging Strategy](#61-logging-strategy)
   - 6.2 [Metrics Collection](#62-metrics-collection)
   - 6.3 [Error Tracking (Future)](#63-error-tracking-future)

7. [Architecture Decision Records (ADRs)](#7-architecture-decision-records-adrs)

8. [Deployment Architecture](#8-deployment-architecture)
   - 8.1 [Vercel Deployment](#81-vercel-deployment)
   - 8.2 [Environment Variables](#82-environment-variables)
   - 8.3 [CI/CD Pipeline](#83-cicd-pipeline)

9. [Disaster Recovery](#9-disaster-recovery)
   - 9.1 [Backup Strategy](#91-backup-strategy)
   - 9.2 [Rollback Procedure](#92-rollback-procedure)

10. [Architecture Checklist](#10-architecture-checklist)

---

## 1. Architecture Overview

### 1.1 System Context Diagram
```
┌──────────────────────────────────────────────────────────┐
│                         USER                             │
│                   (Browser/Mobile)                       │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │ HTTPS
                 │
┌────────────────▼─────────────────────────────────────────┐
│                   VOCALGRID APP                          │
│              (Next.js on Vercel)                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐      ┌─────────────────┐          │
│  │    Frontend     │      │    Backend      │          │
│  │  (React + TS)   │◄────►│  (API Routes)   │          │
│  └─────────────────┘      └─────────────────┘          │
│                                                          │
└──────┬──────────────────┬──────────────────┬────────────┘
       │                  │                  │
       │                  │                  │
   ┌───▼────┐      ┌──────▼─────┐    ┌──────▼─────┐
   │ OpenAI │      │  Supabase  │    │   Vercel   │
   │   API  │      │ PostgreSQL │    │   Edge     │
   └────────┘      └────────────┘    └────────────┘
```

### 1.2 High-Level Architecture
```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
│                      (Browser/Mobile)                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         React Components (Next.js 15)              │    │
│  ├────────────────────────────────────────────────────┤    │
│  │                                                    │    │
│  │  Pages:                                            │    │
│  │  • /               → Home / Table list            │    │
│  │  • /table/[id]     → Table view + voice input     │    │
│  │  • /auth           → Login/signup                 │    │
│  │                                                    │    │
│  │  Components:                                       │    │
│  │  • VoiceRecorder   → Audio capture                │    │
│  │  • DataTable       → Grid display                 │    │
│  │  • SmartPointer    → Active cell indicator        │    │
│  │  • ConfirmDialog   → Ambiguity resolution         │    │
│  │  • Toast           → Notifications                │    │
│  │                                                    │    │
│  │  Styling:                                          │    │
│  │  • Tailwind CSS    → Utility-first CSS            │    │
│  │  • shadcn/ui       → Component library            │    │
│  │                                                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              State Management Layer                 │    │
│  ├────────────────────────────────────────────────────┤    │
│  │                                                    │    │
│  │  Zustand (UI State):                               │    │
│  │  • activeCell, navigationMode                      │    │
│  │  • isRecording, pendingConfirmation               │    │
│  │                                                    │    │
│  │  TanStack Query (Server State):                    │    │
│  │  • tables, tableData queries                       │    │
│  │  • mutations with optimistic updates              │    │
│  │                                                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ HTTP/REST + WebSocket (Real-time)
                       │
┌──────────────────────▼───────────────────────────────────────┐
│                      SERVER LAYER                            │
│                  (Vercel Edge Functions)                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Next.js API Routes (app/api/):                              │
│                                                              │
│  ┌─────────────────────────────────────────────────┐       │
│  │ POST /api/transcribe                            │       │
│  │  ├─ Receive audio blob from client              │       │
│  │  ├─ Call OpenAI Whisper API                     │       │
│  │  ├─ Return transcript JSON                      │       │
│  │  └─ Error handling (timeout, invalid audio)     │       │
│  └─────────────────────────────────────────────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────┐       │
│  │ POST /api/parse                                 │       │
│  │  ├─ Receive: transcript + table context         │       │
│  │  ├─ Call OpenAI GPT-4o-mini                     │       │
│  │  ├─ Run matching algorithms (fuzzy, semantic)   │       │
│  │  ├─ Return structured result with confidence    │       │
│  │  └─ Error handling (no match, ambiguous)        │       │
│  └─────────────────────────────────────────────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────┐       │
│  │ /api/tables/*                                   │       │
│  │  ├─ GET    /api/tables       → List all         │       │
│  │  ├─ POST   /api/tables       → Create           │       │
│  │  ├─ GET    /api/tables/[id]  → Get one          │       │
│  │  ├─ PUT    /api/tables/[id]  → Update           │       │
│  │  ├─ DELETE /api/tables/[id]  → Delete           │       │
│  │  └─ Proxy to Supabase with auth checks          │       │
│  └─────────────────────────────────────────────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────┐       │
│  │ /api/table-data/*                               │       │
│  │  ├─ GET    /api/table-data/[tableId]            │       │
│  │  ├─ POST   /api/table-data/[tableId]            │       │
│  │  ├─ PUT    /api/table-data/[tableId]/[cellId]   │       │
│  │  └─ Optimistic update support                   │       │
│  └─────────────────────────────────────────────────┘       │
│                                                              │
└──────┬────────────────────┬──────────────────────────────────┘
       │                    │
       │                    │
┌──────▼──────┐      ┌──────▼─────────┐
│   OpenAI    │      │   Supabase     │
│     API     │      │  (PostgreSQL)  │
├─────────────┤      ├────────────────┤
│             │      │                │
│ - Whisper   │      │ Tables:        │
│   (STT)     │      │ • tables       │
│             │      │ • table_data   │
│ - GPT-4o    │      │ • auth.users   │
│   (Parse)   │      │                │
│             │      │ Features:      │
│             │      │ • RLS          │
│             │      │ • Real-time    │
│             │      │ • Auth         │
│             │      │                │
└─────────────┘      └────────────────┘
```

---

## 2. Technology Stack Decisions

### 2.1 Frontend

#### **Next.js 15 (App Router)**

**Why:**
- Server Components reduce bundle size
- Built-in API routes (no separate backend needed)
- Excellent TypeScript support
- Industry standard (90% of React jobs)
- Great DX (hot reload, fast refresh)

**Alternatives Considered:**
- ❌ Create React App: Deprecated, no SSR
- ❌ Vite + React: No built-in backend
- ❌ Remix: Smaller ecosystem

**Configuration:**
```typescript
// next.config.js
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};
```

---

#### **TypeScript**

**Why:**
- Type safety catches bugs at compile time
- Better IDE autocomplete
- Self-documenting code
- Industry expectation (80% of jobs require it)

**Alternatives Considered:**
- ❌ JavaScript: Too error-prone for production
- ❌ Flow: Dead project

**Configuration:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

---

#### **Tailwind CSS**

**Why:**
- Rapid prototyping (no CSS files)
- Consistent design system (utility classes)
- Tiny production bundle (PurgeCSS)
- Great documentation

**Alternatives Considered:**
- ❌ CSS Modules: More boilerplate
- ❌ Styled Components: Runtime cost
- ❌ Plain CSS: Hard to maintain

---

#### **shadcn/ui**

**Why:**
- Accessible by default (Radix UI underneath)
- Copy-paste philosophy (you own the code)
- Tailwind-based (consistent styling)
- Beautiful out of the box

**Alternatives Considered:**
- ❌ Material-UI: Heavy, opinionated
- ❌ Chakra UI: Runtime cost
- ❌ Ant Design: Not Tailwind-compatible

---

### 2.2 State Management

#### **Zustand (UI State)**

**Why:**
- Lightweight (1KB gzipped)
- Simple API (no boilerplate)
- React 18 compatible
- DevTools support

**Use Cases:**
- Active cell position
- Recording state
- Navigation mode
- Pending confirmations

**Alternatives Considered:**
- ❌ Redux: Too much boilerplate
- ❌ Context API: Re-render issues
- ❌ Jotai: Less mature

**Example:**
```typescript
import { create } from 'zustand';

interface UIStore {
  activeCell: { row: string; col: string } | null;
  isRecording: boolean;
  setActiveCell: (cell: { row: string; col: string }) => void;
}

const useUIStore = create<UIStore>((set) => ({
  activeCell: null,
  isRecording: false,
  setActiveCell: (cell) => set({ activeCell: cell }),
}));
```

---

#### **TanStack Query v5 (Server State)**

**Why:**
- Smart caching (automatic invalidation)
- Optimistic updates (instant UI)
- Auto retry/refetch
- DevTools for debugging

**Use Cases:**
- Fetching table data
- Mutations (insert/update)
- Real-time sync

**Alternatives Considered:**
- ❌ SWR: Less feature-rich
- ❌ Apollo Client: GraphQL-only
- ❌ RTK Query: Tied to Redux

**Example:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['table', tableId],
  queryFn: () => fetchTable(tableId),
  staleTime: 1000 * 60 * 5, // 5 minutes
});
```

---

### 2.3 Backend

#### **Next.js API Routes (Serverless)**

**Why:**
- Same codebase as frontend
- Auto-deploy with Vercel
- Scales automatically
- No server management

**Alternatives Considered:**
- ❌ Express.js: Need separate hosting
- ❌ .NET API: Different language
- ❌ Python FastAPI: Different language

**Example:**
```typescript
// app/api/transcribe/route.ts
export async function POST(req: Request) {
  const formData = await req.formData();
  const audio = formData.get('audio') as File;
  
  const transcript = await whisper.transcribe(audio);
  
  return Response.json({ text: transcript });
}
```

---

### 2.4 Database

#### **Supabase (PostgreSQL)**

**Why:**
- Built on PostgreSQL (mature, reliable)
- Row Level Security (user isolation)
- Real-time subscriptions (WebSocket)
- Built-in auth (no need for Auth0)
- Generous free tier (500MB, 2GB bandwidth)

**Alternatives Considered:**
- ❌ Firebase: NoSQL limitations
- ❌ PlanetScale: No free tier
- ❌ MongoDB: Not relational

**Free Tier Limits:**
- 500MB database
- 2GB bandwidth/month
- 50K monthly active users
- ✅ Enough for MVP + beta

---

### 2.5 AI Services

#### **OpenAI Whisper API (STT)**

**Why:**
- Best accuracy (especially multi-language)
- Simple REST API
- Supports 97 languages
- Reasonable cost ($0.006/min)

**Alternatives Considered:**
- ❌ Google Speech-to-Text: More expensive
- ❌ AssemblyAI: Less accurate for Hebrew
- ❌ Deepgram: Pricey for hobby project

**Rate Limits (Free Tier):**
- 50 requests/minute
- 50K requests/day (Tier 1)

---

#### **OpenAI GPT-4o-mini (Parsing)**

**Why:**
- Fast (< 1s latency)
- Cheap ($0.15/1M input tokens)
- JSON mode support
- Good at semantic understanding

**Alternatives Considered:**
- ❌ GPT-4: Too slow/expensive for MVP
- ❌ Claude: Similar performance, prefer OpenAI ecosystem
- ❌ Open-source LLMs: Need hosting

**Cost Example:**
- 1000 parses × 100 tokens = 100K tokens
- Input: $0.015
- Output: $0.060
- **Total: $0.075 per 1000 entries**

---

### 2.6 Deployment

#### **Vercel**

**Why:**
- Zero-config Next.js deployment
- Global CDN (low latency)
- Automatic HTTPS
- Free hobby tier (100GB bandwidth)
- Git-based deployments

**Alternatives Considered:**
- ❌ Netlify: Less Next.js optimized
- ❌ AWS: Too complex for MVP
- ❌ Railway: Good, but Vercel is standard

**Free Tier:**
- 100GB bandwidth/month
- 100 serverless function executions/day
- Automatic scaling

---

## 3. Data Flow Diagrams

### 3.1 Voice Input Flow (Detailed)
```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                              │
│    Press and hold microphone button                         │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ZUSTAND UPDATE                                           │
│    store.setIsRecording(true)                               │
│    store.setRecordingState('listening')                     │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. BROWSER API (Client)                                     │
│    navigator.mediaDevices.getUserMedia({ audio: true })     │
│    MediaRecorder.start()                                    │
│    → Visual: Waveform animation                             │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼ (User releases button)
┌─────────────────────────────────────────────────────────────┐
│ 4. STOP RECORDING (Client)                                  │
│    MediaRecorder.stop()                                     │
│    → Triggers ondataavailable                               │
│    → Create Blob from audio chunks                          │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. ZUSTAND UPDATE                                           │
│    store.setRecordingState('processing')                    │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. API CALL: /api/transcribe (Client → Server)              │
│    POST FormData { audio: Blob }                            │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. WHISPER API (Server → OpenAI)                            │
│    POST https://api.openai.com/v1/audio/transcriptions      │
│    Body: { file: audio, model: 'whisper-1' }                │
│    ← Response: { text: "John Smith, 85" }                   │
│    Latency: ~1-2 seconds                                    │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. API CALL: /api/parse (Server logic)                      │
│    Input: { transcript, tableSchema, activeCell }           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. GPT-4o-mini (Server → OpenAI)                            │
│    POST https://api.openai.com/v1/chat/completions          │
│    Prompt: "Extract entity and value from transcript..."    │
│    ← Response: {                                            │
│         entity: "John Smith",                               │
│         value: 85,                                          │
│         confidence: 0.95                                    │
│      }                                                      │
│    Latency: ~500ms-1s                                       │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. MATCHING ALGORITHM (Server logic)                       │
│     • Run fuzzy matching (Levenshtein, Soundex)             │
│     • Validate value against column type                    │
│     • Return structured result                              │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. RESPONSE TO CLIENT                                      │
│     ← { entity, value, confidence, action }                 │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. ZUSTAND UPDATE (Client)                                 │
│     store.setRecordingState('confirming')                   │
│     store.setPendingConfirmation(result)                    │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 13. UI CONFIRMATION (Client)                                │
│     IF confidence ≥ 0.85:                                   │
│       → Auto-confirm after 2s                               │
│     ELSE:                                                   │
│       → Show dialog: "Did you mean...?"                     │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼ (User confirms or auto-confirm)
┌─────────────────────────────────────────────────────────────┐
│ 14. TANSTACK QUERY MUTATION (Client)                        │
│     mutation.mutate({                                       │
│       tableId, rowId, columnId, value                       │
│     })                                                      │
│                                                             │
│     onMutate: Optimistic update (instant UI)                │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 15. DATABASE WRITE (Client → Supabase)                      │
│     supabase.from('table_data').upsert({...})               │
│     Latency: ~200-500ms                                     │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 16. SUCCESS FEEDBACK (Client)                               │
│     • Cell flashes green                                    │
│     • store.setRecordingState('committed')                  │
│     • store.advancePointer() → next cell                    │
│     • Optional: TTS "85 for John, saved"                    │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 17. RESET STATE (Client)                                    │
│     store.setRecordingState('idle')                         │
│     store.setPendingConfirmation(null)                      │
│     → Ready for next input                                  │
└─────────────────────────────────────────────────────────────┘

TOTAL LATENCY: ~3-4 seconds (user perception)
  - STT: 1-2s
  - LLM: 0.5-1s
  - DB write: 0.2-0.5s
  - Network overhead: 0.3-0.8s
```

### 3.2 Table Load Flow
```
┌─────────────────────────────────────────────────────────────┐
│ USER: Navigate to /table/[id]                               │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ NEXT.JS: Server-side render (RSC)                           │
│ • Extract tableId from URL params                           │
│ • Fetch table schema (server component)                     │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE QUERY (Server)                                     │
│ SELECT * FROM tables WHERE id = ?                           │
│ → Returns: { id, name, schema, settings }                   │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ RENDER TABLE SHELL (Server → HTML)                          │
│ • Table headers (from schema.columns)                       │
│ • Empty rows (client will fill)                             │
│ • Send to browser                                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ CLIENT: Hydration                                           │
│ • React takes over                                          │
│ • TanStack Query fetches data                               │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ TANSTACK QUERY (Client)                                     │
│ useQuery(['table-data', tableId], fetchTableData)           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE QUERY (Client → Supabase)                          │
│ SELECT * FROM table_data WHERE table_id = ?                 │
│ → Returns: [{ row_id, column_id, value }, ...]              │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ RENDER DATA (Client)                                        │
│ • Transform flat data → 2D grid                             │
│ • Populate cells                                            │
│ • Enable interactions                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Security Architecture

### 4.1 Authentication Flow
```
┌─────────────────────────────────────────────────────────────┐
│ USER: Click "Sign Up"                                       │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE AUTH                                               │
│ supabase.auth.signUp({                                      │
│   email: 'user@example.com',                                │
│   password: '********'                                      │
│ })                                                          │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ EMAIL VERIFICATION (optional for MVP)                       │
│ • Supabase sends confirmation email                         │
│ • User clicks link                                          │
│ • Account activated                                         │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ SESSION CREATION                                            │
│ • JWT token stored in localStorage                          │
│ • Auto-refresh on expiry                                    │
│ • Expires after 7 days (default)                            │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ AUTHENTICATED REQUESTS                                      │
│ All API calls include:                                      │
│   Authorization: Bearer <JWT>                               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Row Level Security (RLS)
```sql
-- Users can only see their own tables
CREATE POLICY "Users view own tables"
  ON tables FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only modify their own tables
CREATE POLICY "Users modify own tables"
  ON tables FOR ALL
  USING (auth.uid() = user_id);

-- Users can only see data from their own tables
CREATE POLICY "Users view own table data"
  ON table_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tables
      WHERE tables.id = table_data.table_id
      AND tables.user_id = auth.uid()
    )
  );
```

### 4.3 API Security

**Rate Limiting:**
```typescript
// lib/rate-limit.ts
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 10,  // 10 requests
  interval: 'minute',
});

export async function checkRateLimit(userId: string) {
  const hasToken = await limiter.removeTokens(1);
  if (!hasToken) {
    throw new Error('Rate limit exceeded');
  }
}
```

**CORS Configuration:**
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://vocalgrid.com' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, GET, OPTIONS' },
        ],
      },
    ];
  },
};
```

---

## 5. Scalability Considerations

### 5.1 Performance Optimization

**Frontend:**
- ✅ Code splitting (Next.js automatic)
- ✅ Image optimization (next/image)
- ✅ Font optimization (next/font)
- ✅ Tree shaking (unused code removal)

**Backend:**
- ✅ Edge functions (low latency globally)
- ✅ API route caching (stale-while-revalidate)
- ✅ Database connection pooling (Supabase)

**Database:**
- ✅ Indexes on foreign keys
- ✅ Partial indexes for common queries
- ✅ Query optimization (EXPLAIN ANALYZE)

### 5.2 Future Scaling Path
```
MVP (0-100 users)
├─ Free tiers (Vercel, Supabase, OpenAI credits)
├─ No optimization needed
└─ Cost: ~$0-50/month

Growth (100-1K users)
├─ Vercel Pro ($20/month)
├─ Supabase Pro ($25/month)
├─ OpenAI pay-as-you-go (~$100-300/month)
├─ Add: Redis caching (Upstash)
└─ Cost: ~$150-350/month

Scale (1K-10K users)
├─ Vercel Team ($XX/month)
├─ Supabase Team ($XX/month)
├─ OpenAI dedicated instance
├─ CDN for audio files (Cloudflare R2)
├─ Database read replicas
└─ Cost: ~$1K-3K/month
```

---

## 6. Monitoring & Observability

### 6.1 Logging Strategy
```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, meta?: object) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta }));
  },
  error: (message: string, error: Error, meta?: object) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error.message,
      stack: error.stack,
      ...meta,
    }));
  },
};

// Usage in API route
logger.info('Voice input processed', {
  userId,
  tableId,
  duration: latency,
  confidence: result.confidence,
});
```

### 6.2 Metrics Collection
```typescript
// lib/analytics.ts
import { track } from '@vercel/analytics';

export const trackVoiceInput = (data: {
  duration_ms: number;
  stt_duration_ms: number;
  llm_duration_ms: number;
  confidence: number;
  success: boolean;
}) => {
  track('voice_input', data);
};

// Usage
trackVoiceInput({
  duration_ms: totalDuration,
  stt_duration_ms: sttLatency,
  llm_duration_ms: llmLatency,
  confidence: result.confidence,
  success: true,
});
```

### 6.3 Error Tracking (Future)

**Sentry Integration:**
```typescript
// sentry.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});

// Automatic error capture
// Manual capture:
Sentry.captureException(error);
```

---

## 7. Architecture Decision Records (ADRs)

### ADR-001: Use Next.js App Router over Pages Router

**Status:** Accepted  
**Date:** Feb 2025

**Context:**
Next.js 13+ introduced App Router with Server Components.

**Decision:**
Use App Router for new project.

**Consequences:**
- ✅ Better performance (less client JS)
- ✅ Future-proof (Pages Router in maintenance mode)
- ⚠️ Steeper learning curve
- ⚠️ Some libraries not compatible yet

---

### ADR-002: Use Supabase over Firebase

**Status:** Accepted  
**Date:** Feb 2025

**Context:**
Need database + auth + real-time.

**Decision:**
Use Supabase (PostgreSQL-based).

**Consequences:**
- ✅ SQL familiarity (relational model)
- ✅ Row Level Security (better auth model)
- ✅ Open source (can self-host later)
- ⚠️ Smaller community than Firebase

---

### ADR-003: Optimistic Updates for Cell Editing

**Status:** Accepted  
**Date:** Feb 2025

**Context:**
Voice input latency makes app feel slow.

**Decision:**
Use TanStack Query's optimistic updates.

**Consequences:**
- ✅ Instant UI feedback
- ✅ Better perceived performance
- ⚠️ Need rollback logic for errors
- ⚠️ Potential UI flicker on conflict

---

## 8. Deployment Architecture

### 8.1 Vercel Deployment
```
┌─────────────────────────────────────────┐
│        GitHub Repository                │
│     (main branch = production)          │
└──────────────┬──────────────────────────┘
               │
               │ Git push
               │
┌──────────────▼──────────────────────────┐
│          Vercel Platform                │
├─────────────────────────────────────────┤
│                                         │
│  Build Process:                         │
│  1. npm install                         │
│  2. npm run build (Next.js)             │
│  3. Optimize assets                     │
│  4. Deploy to Edge Network              │
│                                         │
└──────────────┬──────────────────────────┘
               │
               │ Deploy
               │
┌──────────────▼──────────────────────────┐
│      Vercel Edge Network                │
│   (Global CDN - 100+ locations)         │
├─────────────────────────────────────────┤
│                                         │
│  • Static assets (JS, CSS, images)      │
│  • Server Components (pre-rendered)     │
│  • API Routes (serverless functions)    │
│  • Automatic HTTPS                      │
│                                         │
└─────────────────────────────────────────┘
```

### 8.2 Environment Variables
```bash
# .env.local (development)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
OPENAI_API_KEY=sk-xxx...

# Vercel Dashboard (production)
# Same variables configured in UI
# Automatically injected at build time
```

### 8.3 CI/CD Pipeline
```
┌─────────────────────────────────────────┐
│  Developer: git push origin main        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Vercel: Auto-detect push               │
│  • Trigger build                        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Build Process                          │
│  1. Install dependencies                │
│  2. Run TypeScript check                │
│  3. Run ESLint                          │
│  4. Build Next.js app                   │
│  5. Run tests (if any)                  │
└──────────────┬──────────────────────────┘
               │
               ▼ (if success)
┌─────────────────────────────────────────┐
│  Deploy to Production                   │
│  • Update live site                     │
│  • Purge CDN cache                      │
│  • Send deployment notification         │
└─────────────────────────────────────────┘
```

---

## 9. Disaster Recovery

### 9.1 Backup Strategy

**Database (Supabase):**
- Automatic daily backups (7-day retention)
- Point-in-time recovery (PITR)
- Manual backup before schema changes

**Code (GitHub):**
- Git version control
- All changes tracked
- Easy rollback to any commit

### 9.2 Rollback Procedure
```bash
# If deployment breaks production:

# Option 1: Instant rollback (Vercel UI)
# → Click "Redeploy" on previous deployment

# Option 2: Git revert
git revert HEAD
git push origin main
# → Vercel auto-deploys previous version

# Option 3: Manual rollback
vercel rollback <deployment-url>
```

---

## 10. Architecture Checklist

**Before Launch:**
- [ ] All API routes have error handling
- [ ] Database has RLS policies
- [ ] Environment variables set in Vercel
- [ ] HTTPS configured (automatic with Vercel)
- [ ] CORS headers configured
- [ ] Rate limiting implemented
- [ ] Logging enabled
- [ ] Analytics tracking added
- [ ] Backup strategy documented
- [ ] Rollback tested

---

*End of Architecture Documentation*