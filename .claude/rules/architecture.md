---
description: Lib zone separation, import rules, single responsibility, and DRY enforcement
globs: lib/**, components/**, app/**
---

# Architecture Rules

## Lib Zone Map

`lib/` is divided into four zones. Never import across zone boundaries in the wrong direction.

| Zone | Root path | Who can import it | Responsibility |
|---|---|---|---|
| **Client** | `lib/client/` | Client components & hooks only | React hooks, Zustand stores, navigation strategies |
| **Server** | `lib/server/` | API routes & server components only | Business-logic services, parsers, matching, caches |
| **Shared** | `lib/shared/` | Client and server | Types, utils, error mapping, logging, monitoring |
| **Generated** | `lib/generated/` | Never edit manually | Prisma-generated output — treat as read-only |

**Sub-folder breakdown:**

- `lib/client/hooks/` — all React hooks (voice pipeline, VAD, debounce, etc.)
- `lib/client/stores/` — Zustand stores
- `lib/client/navigation/` — pointer/navigation strategies
- `lib/server/services/` — DB queries + OpenAI calls (only place Prisma/Supabase is called from inside API routes)
- `lib/server/parsers/` — value parsing (boolean, number, text normalizer)
- `lib/server/matching/` — entity recognition and fuzzy/phonetic matching
- `lib/server/cache/` — server-side in-memory caches
- `lib/shared/types/` — shared TypeScript interfaces and Zod schemas
- `lib/shared/utils/` — pure utility functions safe on both sides
- `lib/shared/errors/` — error mapping and classification
- `lib/shared/monitoring/` — monitoring/metrics helpers
- `lib/shared/logging/` — logger (client-side safe)
- `lib/prisma.ts`, `lib/supabase.ts`, `lib/query-keys.ts` — singleton clients and TanStack Query key factory

## Import Rules (enforce strictly)

- A client component or hook must **never** import from `lib/server/`.
- An API route or server component must **never** import from `lib/client/`.
- `lib/shared/` is the only zone that may be imported from anywhere.
- Never import from `lib/generated/` directly — use the re-exports in `lib/shared/generated/` or the Prisma singleton in `lib/prisma.ts`.
- A component that calls Prisma/Supabase directly is wrong — route through `lib/server/services/`.

## Single Responsibility

- Each component, hook, or function must do **one thing**. If you need "and" to describe it, split it.
- Keep components declarative: they receive props and call handlers. The hook drives the logic.
- Any state machine, derived state, or multi-step async flow must be extracted into a custom hook in `lib/client/hooks/`.

## DRY — Extract at Second Repetition

If a piece of logic or JSX appears in more than one place, extract it immediately:
- Shared pure logic → `lib/shared/utils/`
- Client-only logic → `lib/client/hooks/`
- Server-only logic → `lib/server/services/` or the relevant `lib/server/` sub-folder
- Shared UI → `components/ui/` (primitive) or `components/` (feature-level)

Before writing a new utility, search `lib/` to confirm it does not already exist.

## New Libraries

- The approved library list is defined in `docs/02_ARCHITECTURE.md §4.1`.
- **Do not install any unapproved library without explicit user confirmation.**
- When a new library appears necessary, stop and ask: what problem it solves, what it replaces, and its bundle/security impact.
