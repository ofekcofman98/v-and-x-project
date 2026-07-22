# VocalGrid Technical Specification & Feature Map

**Notes:** Check monday · MCP to zoom
**Stack:** Next.js (App Router), Tailwind CSS, Zustand, Prisma + Supabase (PostgreSQL with Vector Embeddings)
**AI Engine:** OpenAI (Whisper API for STT + GPT-4o-mini for parsing)
**Core Systems:** Voice Pipeline with VAD (Voice Activity Detection), Continuous Mode, Smart Pointer (Row-First/Column-First navigation), and a Hybrid Matching Engine (Exact + Fuzzy + Vector Match)

---

## Table of Contents

1. [UI/UX Architecture: Unified Workspace Canvas](#1-uiux-architecture-unified-workspace-canvas)
2. [The Blueprint Hub (Zero-Token Initialization)](#2-the-blueprint-hub-zero-token-initialization)
3. [Contextual Entity Referencing via "@-mention" Dropdown](#3-contextual-entity-referencing-via--mention-dropdown)
4. [Advanced AI Table Agent & Token Delta Optimization](#4-advanced-ai-table-agent--token-delta-optimization)
5. [Local Development Tooling: Custom MCP Server](#5-local-development-tooling-custom-mcp-server)

---

## Technical Context (For the AI Engine)

- **Stack:** Next.js (App Router), Tailwind CSS, Zustand, Prisma + Supabase (PostgreSQL with Vector Embeddings).
- **AI Engine:** OpenAI (Whisper API for STT + GPT-4o-mini for parsing).
- **Core Systems:** Voice Pipeline with VAD (Voice Activity Detection), Continuous Mode, Smart Pointer (Row-First/Column-First navigation), and a Hybrid Matching Engine (Exact + Fuzzy + Vector Match).

---

## 1. UI/UX Architecture: Unified Workspace Canvas

**The Problem:** The current separation between pages (e.g., `/dashboard/base-lists`, `/dashboard/tables`, templates) creates a disjointed experience and high cognitive load for non-technical users.

**The Solution:** Transition from isolated pages to a single, fluid Canvas View.

- **Layout:** A unified dashboard featuring a persistent, collapsible sidebar displaying Base Lists (static data sources, like a classroom roster), while the main screen renders the active Data Grid (Table).
- **Relationships:** Users can seamlessly bridge static lists with active sheets—for instance, clicking a "Generate Attendance Table" action directly from a selected student list, automatically spawning a new relational grid tracking dates and status.
- **Zustand Store Integration:** Refactor standalone stores (`table-store.ts`, `base-list-store.ts`) into a synchronized hierarchy or implement cross-store subscriptions. This ensures changes or selections in the Base Lists update the active grid smoothly with a single render cycle, avoiding flickering, desync, or client-side UI lag.

---

## 2. The Blueprint Hub (Zero-Token Initialization)

**The Problem:** Asking an LLM to generate table structural frameworks from scratch every time introduces latency, risks hallucinations, and wastes input/output tokens.

**The Solution:** Create a visual Modal/Dialog Grid featuring rigid pre-set configurations (Blueprints) geared towards non-technical personas (e.g., Attendance Roster, Recipe/Ingredient Checklist, Quick Sticky Notes, Inventory Ledger).

**Performance & Cost Engineering:**

- Clicking a template generates the columns and row structures entirely client-side using hardcoded local schemas (0ms latency, 0% LLM token expenditure).
- The LLM (GPT-4o-mini) is completely bypassed during table creation and is only invoked later when the user utilizes voice commands to asynchronously fill or edit cells inside that structured template.

---

## 3. Contextual Entity Referencing via "@-mention" Dropdown

**The Problem:** Dynamic text or vocal generation often suffers from entity ambiguity (e.g., spelling variations like "Jon" vs "John"). Passing an entire list database as systemic context to the LLM to figure out relations is cost-prohibitive and slow.

**The Solution:** Implement a rich text or textarea listener that captures the `@` character in user prompt fields and triggers a floating dropdown showing available client-side `baseLists` and tables.

- **Frontend UX:** Selecting a list converts the raw text into a styled UI component (Badge) holding the strict database entity ID (`[entity:12345]`).
- **AI Prompt Optimization:** The server-bound payload will isolate the mention, feeding the LLM only the specific JSON schema of the referenced list. This ensures 100% predictive accuracy, avoids hallucinated names, and slices API token ingestion fees exponentially.

---

## 4. Advanced AI Table Agent & Token Delta Optimization

**Feature Description:** A dedicated backend API route handling unstructured text or audio commands to dynamically build out custom grid additions or modifications using OpenAI's Structured Outputs (`response_format`) bound to a strict JSON schema.

**Token Optimization Strategy:** When updating or populating a large, pre-existing data grid, the system must not transmit the entire cell history back to the LLM. Instead, the input payload will pass exclusively the column structure (Schema keys) paired with the prompt. The model will be strictly instructed to return only the Delta (the rows/cells that need to be created or modified), which the Zustand store handles via an optimistic UI patch.

---

## 5. Local Development Tooling: Custom MCP Server

**Feature Description:** Build a localized Model Context Protocol (MCP) server built on TypeScript that directly interfaces with the Prisma client / Supabase database instance.

**Usage Context:** Once loaded locally into Cursor or Claude Desktop, the developer can type direct instructions in the side-chat (e.g., "Claude, clear out any empty rows in my active local test grid" or "Reset the embedding vectors for list ID 5"). The LLM will securely call the exposed server tools to safely mutate the database state instantly during developer cycles.
