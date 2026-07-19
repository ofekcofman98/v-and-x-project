# Perceived Performance & Navigation UX

**Priority:** High
**Dependencies:** 04_STATE_MANAGEMENT.md, 10_PERFORMANCE.md, 14_PRODUCT_DATA_FLOW.md
**Status:** Not Started

---

## Overview

Fixes the root cause of the app feeling slow to navigate: list and detail pages refetch all data from scratch on every visit and re-show loading skeletons, even for data the user just looked at seconds ago.

**User Story:**
- User opens Tables, clicks into a table, then clicks back to Tables
- Currently: full skeleton flash + refetch of `/api/tables`, `/api/base-lists` again
- After this fix: cached data renders instantly, a silent background revalidation happens, and only a genuinely first-ever load shows a skeleton

**Impact:**
- Removes the single biggest contributor to "the app feels slow to click around in"
- Establishes the intended data-fetching pattern (`lib/query-keys.ts` + TanStack Query) before CSV import and other upcoming features add more pages that would otherwise copy the current ad-hoc fetch pattern
- Also profiles and fixes API routes that are slow even when warm (not just a client caching problem)

---

## Root Cause (confirmed in code)

- `app/providers.tsx` configures a `QueryClient` (`staleTime: 5min`) and `lib/query-keys.ts` exists as the intended query-key factory — but it is currently **empty and unused**.
- Every list/detail page fetches through hand-rolled Zustand stores (`lib/client/stores/table-store.ts`, `base-list-store.ts`, `column-template-store.ts`, `table-cell-store.ts`) that call `fetch()` inside a `useEffect` on **every mount**, unconditionally setting `isLoading: true`. There is no cache, no dedup, no background revalidation.
- `docs/features/logs_for_optimization.md` shows this in practice — repeated back-to-back `/api/base-lists` and `/api/tables` calls across navigations in the same session.
- Separately, some API routes show 400–700ms **render** time even when warm (e.g. `/api/tables`) — a real service-layer cost independent of the client caching issue, worth profiling in `lib/server/services/`.
- Large "compile: 1200–1900ms" numbers in that log are Next.js dev-mode on-demand compilation and should be re-verified against a production build (`npm run build && npm start`) before assuming they represent real user-facing latency.

**Explicitly out of scope for this doc:** visual/interaction polish (spacing, animation, empty-state redesign). Tracked separately as a future `docs/features/12_ux_polish.md` once navigation speed is fixed.

---

## Implementation Plan

### 1. Verify baseline
Run `npm run build && npm start`, repeat the navigations from `logs_for_optimization.md`, and re-capture timings to separate real slowness from dev-mode compile noise.

### 2a. `table-cell-store.ts` — targeted fix, not a full TanStack Query migration

On inspection, this store is intentionally different from the list stores above: `components/shared-table/DataTableCell.tsx` subscribes to individual cells via fine-grained Zustand selectors (`getCellValue`, `lastUpdatedCell`) to avoid re-rendering the whole grid on every voice update, and `lib/client/hooks/use-voice-action-handler.ts` calls `updateCell` directly as part of the voice pipeline's optimistic-update-with-rollback flow (per `docs/voice-pipeline.md`). That's the correct pattern for this data — rewriting it onto TanStack Query would mean re-deriving the same fine-grained subscription and optimistic-rollback behavior with no real benefit, at real risk to a working, latency-sensitive feature.

The actual bug matching the reported symptom was narrower: `fetchCells(tableId)` (called from `components/shared-table/DataTable.tsx`'s mount effect) refetched and reset `isLoading` unconditionally every time the table view mounted, so revisiting a table you'd just looked at replayed the "Loading table data..." state. Fixed by adding a `loadedTableId`/`fetchedAt` guard to `fetchCells` (5-minute staleness window, matching the `QueryClient` `staleTime` in `app/providers.tsx`) — `updateCell`, `getCellValue`, and the optimistic-rollback logic are unchanged.

### 2. Migrate list/detail data fetching to TanStack Query
- Populate `lib/query-keys.ts` with keys for `tables`, `baseLists`, `columnTemplates` (`table-cell-store.ts` intentionally excluded — see §2a).
- In `table-store.ts`, `base-list-store.ts`, `column-template-store.ts`: move `fetch('/api/...')` calls into query functions consumed via `useQuery`; keep Zustand only for client-only UI state (selection, pending-delete id).
- Convert delete actions to `useMutation` with `queryClient.invalidateQueries`.
- Pages touched: `app/dashboard/tables/page.tsx`, `app/dashboard/base-lists/page.tsx`, `app/dashboard/templates/page.tsx`, `app/dashboard/tables/[id]/page.tsx`, `app/dashboard/base-lists/[id]/page.tsx`, `app/dashboard/templates/[id]/page.tsx`.

### 3. Fix loading-state UX
- Show the full skeleton only on true first load (`isLoading && !data`), not on every background refetch (`isFetching`).
- Prefetch the query cache on link hover for "View Table"/row links, alongside Next's existing `Link prefetch`.

### 4. Profile slow API routes — finding
- `listTables`/`listBaseLists` themselves are single, well-shaped Prisma queries (proper `include`, no N+1).
- The actual cost is in `lib/server/services/auth.ts` → `getAuthenticatedUser()`, which calls `supabase.auth.getUser()` on **every** API request. This deliberately makes a network round-trip to Supabase's Auth server to revalidate the JWT (the secure pattern vs. decoding the token locally, which is faster but doesn't check for revocation). That round-trip is almost certainly the dominant cost behind the 400–700ms warm render times, not a database inefficiency.
- This is a security/latency tradeoff, not a bug. **Decision (approved):** Option A — a 45s in-memory `LRUCache` (`lru-cache`, already a project dependency) in `lib/server/services/auth.ts`, keyed by the request's Supabase auth cookie value(s), storing the validated `User`. `getAuthenticatedUser()` checks the cache first and only calls `supabase.auth.getUser()` on a miss, preserving revocation-checking within the TTL window instead of dropping it via local JWT decode (Option B).

---

## Verification

- Click dashboard → tables → a table → back → tables. Confirm no skeleton flash on the second visit and no duplicate network calls in the browser Network tab.
- Compare production-build timings for `/api/tables`, `/api/base-lists`, and a table detail page against the original `logs_for_optimization.md` numbers.
- `npm run lint` and `npm run test` pass; any store actions used outside the migrated pages (e.g. `addTable`, `deleteTable`) still work.

---

## Status

- [x] `lib/query-keys.ts` populated (`tables`, `baseLists`)
- [x] Tables list + detail pages migrated to TanStack Query (`lib/client/hooks/use-tables.ts`, `app/dashboard/tables/page.tsx`, `app/dashboard/tables/[id]/page.tsx`)
- [x] Base Lists list + detail pages migrated to TanStack Query (`lib/client/hooks/use-base-lists.ts`, `app/dashboard/base-lists/page.tsx`, `app/dashboard/base-lists/[id]/page.tsx`)
- [x] Column Templates list + detail pages migrated to TanStack Query (`lib/client/hooks/use-column-templates.ts`, `app/dashboard/templates/page.tsx`, `app/dashboard/templates/[id]/page.tsx`); `components/column-templates/DynamicTemplateCreator.tsx` now also invalidates the query cache on create so a newly saved template shows up immediately on the dashboard
- [x] `npx tsc --noEmit` passes after each migration step
- [x] API route profiling done — root cause identified as `getAuthenticatedUser()`'s per-request Supabase round-trip, not a DB query issue (see §4 above)
- [x] `getAuthenticatedUser()` fixed with a 45s `LRUCache` keyed by the auth cookie value, cutting the per-request Supabase round-trip to once per TTL window per session (see §4 above)
- [x] `table-cell-store.ts` fixed with a `loadedTableId`/`fetchedAt` staleness guard on `fetchCells` (see §2a) — deliberately not migrated to TanStack Query; the existing fine-grained-selector + optimistic-update pattern is correct for the voice pipeline and was left untouched
- [ ] **Deferred:** Hover prefetch on list→detail links — natural follow-on once detail pages also read through TanStack Query
- [ ] Baseline prod-build timing capture (`npm run build && npm start`) — not yet re-run against these changes
- [ ] Manual click-through verification (no skeleton flash / no duplicate calls on Tables & Base Lists)
