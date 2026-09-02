# Entity-First Navigation Mode — Spec

**Feature:** 18 — Entity-First Navigation
**Priority:** Medium
**Dependencies:** `docs/06_SMART_POINTER.md`, `docs/05_VOICE_PIPELINE.md`, `docs/features/03_ai_table_agent.md`, `.claude/rules/voice-pipeline.md`
**Status:** Implemented
**Last Updated:** 2026-08-22

---

## Table of Contents

1. [Problem](#1-problem)
2. [Goal](#2-goal)
3. [Constraints From The Existing System](#3-constraints-from-the-existing-system)
4. [Already Available (Reuse, Do Not Rebuild)](#4-already-available-reuse-do-not-rebuild)
5. [New Scope 1: Type Consolidation](#5-new-scope-1-type-consolidation)
6. [New Scope 2: Server Segmentation + Resolution](#6-new-scope-2-server-segmentation--resolution)
7. [New Scope 3: Client Pointer + UI](#7-new-scope-3-client-pointer--ui)
8. [Data Contract](#8-data-contract)
9. [Out of Scope](#9-out-of-scope)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [Implementation Order](#11-implementation-order)
12. [Notes for Reviewers](#12-notes-for-reviewers)

---

## 1. Problem

VocalGrid has two voice navigation modes today: **column-first** (`entity, value, entity, value, …`, one column filled down many rows) and **row-first** (`value, value, value`, one row filled across many columns, entity implied by the pointer). Neither models how a teacher grades student-by-student: name the student once, then speak that student's scores across columns — `"Dana 90 85 70, Yossi 70 60 55"`. Column-first would force repeating the name per value; row-first cannot name an entity at all.

## 2. Goal

Add a third navigation mode, **entity-first**, that accepts one or more `(entity, values…)` groups per utterance, resolves each entity to a row, and writes each group's values positionally into that row's columns starting from the currently active column.

---

## 3. Constraints From The Existing System

1. **`NavigationMode` has no single source of truth today.** The `'column-first' | 'row-first'` literal union is independently re-declared in `lib/shared/types/voice-pipeline.ts`, `lib/client/stores/ui-store.ts` (client-canonical), `llm-prompts.ts`, `row-first.ts`, `parse-service.ts` (twice), and `lib/shared/types/models.ts`; `app/api/parse/route.ts` has its own `z.enum`, and `app/api/voice-entry/route.ts` uses an unvalidated `as` cast. A third literal must be added everywhere or it will silently behave as column-first at any site missed. **Decision: consolidate into one exported type in `lib/shared/types/voice-pipeline.ts` first (§5), before writing any entity-first logic**, so the compiler — not manual auditing — finds every remaining branch.

2. **Only one branch site is exhaustive.** `lib/client/navigation/strategies.ts`'s `Record<NavigationMode, NavigationStrategy>` is a compile-time-checked map; every other mode check in the codebase (`batch-orchestrator.ts`, `use-provisional-target.ts`, the cell/band components, `NavigationModeToggle.tsx`) is a binary ternary or `!== 'row-first'` guard whose `else` branch silently means "treat as column-first." **Decision: convert these to `switch` statements with a `never`-exhaustiveness default as part of this feature**, not just add a third case — otherwise entity-first inherits column-first behavior at every unconverted site.

3. **Row-first's mid-row fast path is deliberately not reused for entity-first.** `isRowFirstMidRow` (`row-first.ts`) lets `pipeline.ts`'s single-entry path skip entity matching once the pointer is past the first editable column, because in row-first the entity is already fixed by the pointer's row. In entity-first, every utterance re-names its entity — there is no "mid-row, entity already known" state at the single-entry level. **Decision: `isRowFirstMidRow` stays row-first-only; entity-first single-entry parses always run the full entity-matching path** (§6).

4. **Entity-first's batch shape is a genuine hybrid, not a third parallel implementation.** Column-first's batch resolver (`resolveColumnFirstEntry`) does entity matching per value; row-first's (`resolveRowFirstColumnTargets` + `resolveRowFirstEntry`) does positional column-walking with no matching. Entity-first needs matching once per group and column-walking per group's values. **Decision: the entity-first resolver composes both existing functions rather than reimplementing either** (§6).

5. **The client pointer motion for entity-first is identical to row-first's** (down to the next row, back to a fixed start column) — the actual difference between the two modes is entirely in speech parsing (whether a spoken value carries an entity name) and in what a batch commit re-targets to. **Decision: `strategies.ts` aliases `rowFirstStrategy` for `entity-first` rather than defining new cell-motion math**; the pointer re-targeting after a batch commit is handled separately in `use-voice-batch-handler.ts` (§7), not in the strategy.

---

## 4. Already Available (Reuse, Do Not Rebuild)

- `matchAsync` — entity → row matching, used as-is (`lib/server/services/voice-entry-service/batch-resolve.ts`'s `resolveColumnFirstEntry`).
- `resolveRowFirstColumnTargets` (`batch-row-first.ts`) — positional column-walk from an active index with `overflowCount` reporting. Called once per entity-first group instead of once per utterance.
- `parseForColumn` — per-cell value parsing/validation, used identically by both existing resolvers.
- `looksLikeBatchUtterance` (`batch-detect.ts`) — mode-agnostic regex gate; expected to already fire for the entity-first shape (multiple numbers / comma-separated segments) with no change.
- `rowFirstStrategy` (`lib/client/navigation/strategies.ts`) — aliased for entity-first cell motion (§3.5).
- `extractEntityQuick` + client `MatcherChain` (`use-provisional-target.ts`'s column-first branch) — reused, applied once per utterance instead of per value, for the provisional entity highlight.
- Batch-orchestrator's local→LLM segmentation fallback pattern (`batch-segmentation.ts` / `batch-llm-segmentation.ts`) — mirrored for the new segmentation function, not reinvented.

---

## 5. New Scope 1: Type Consolidation

**Status: implemented.**

- **`lib/shared/types/voice-pipeline.ts`** — add and export `NavigationMode = 'column-first' | 'row-first' | 'entity-first'`. This becomes the single source of truth.
- Replace inline re-declarations with imports of this type in: `lib/client/stores/ui-store.ts` (re-exported from here for existing import sites), `llm-prompts.ts`, `row-first.ts`, `parse-service.ts` (both occurrences), `lib/shared/types/models.ts` (`TableSettings.voice.defaultMode`).
- Widen `z.enum([...])` in `app/api/parse/route.ts` to include `'entity-first'`.
- Replace the unvalidated `as` cast in `app/api/voice-entry/route.ts` with the same Zod enum used by `/api/parse`, so an unknown mode 400s instead of silently defaulting to `'column-first'`.
- Convert the binary ternaries listed in §3.2 to exhaustive `switch` statements with a `never` default arm, surfacing every remaining site as a compile error until handled.

## 6. New Scope 2: Server Segmentation + Resolution

**Status: implemented.**

- **Segmentation shape:** `{ groups: [{ entityText: string, rawValues: string[] }] }`, 1–30 groups per utterance (same cap as the existing batch schemas).
- **`batch-segmentation.ts`** — new `segmentEntityGroupsLocal`, modeled on `segmentEntityValuePairsLocal`: split the transcript on comma/`and` boundaries, treat the first token of each segment as `entityText`, the remainder as `rawValues`.
- **`batch-llm-segmentation.ts`** — new `buildEntityGroupPrompt` + `segmentEntityGroupsViaLLM` (Zod schema per the shape above), as the fallback when local segmentation fails, mirroring the existing bare-value/entity-value pair fallback.
- **`batch-orchestrator.ts`** — new `resolveEntityFirstBatch`, invoked from the mode fork (now a `switch`, per §5) alongside `resolveRowFirstBatch` / `resolveColumnFirstBatch`. Per group: match `entityText` via `matchAsync` (as `resolveColumnFirstEntry` does) to resolve the row; call `resolveRowFirstColumnTargets` from the utterance's start column to map `rawValues` onto that row's columns; write each via `parseForColumn`, carrying the matcher's `entity`/`confidence`/`matchType` (not the row-first resolver's hardcoded `exact`/`1.0`). Sum `overflowCount` across groups; overflow values are parked, never spilled into the next row or group.
- **`pipeline.ts`** — no change to the Stage 3.5 mid-row fast path (row-first only, per §3.3). Entity-first single-entry parses fall through to the existing entity-matching stages unchanged.
- **`llm-prompts.ts` / `parse-service.ts`** — the `navigationMode` value already only appears as an interpolated display string in these prompts; verify the text still reads sensibly with `'entity-first'`, no branching needed.

## 7. New Scope 3: Client Pointer + UI

**Status: implemented.**

- **`lib/client/navigation/strategies.ts`** — add `entity-first: rowFirstStrategy` to the `Record<NavigationMode, NavigationStrategy>` (§3.5).
- **`use-voice-batch-handler.ts`** — after a committed entity-first batch, re-target the pointer to **the last resolved entity's row, at the utterance's starting column** (not the row-first behavior of advancing once per write). This mirrors "the teacher moves to the next student" while keeping the start column stable for the next utterance.
- **`use-provisional-target.ts`** — new entity-first branch: extract and match the entity from the first token of the (partial) transcript only, once; hold that row as the provisional target for the remainder of the utterance rather than re-matching per value (row-first's behavior) or per value pair (column-first's behavior).
- **`NavigationModeToggle.tsx`** — add a third `MODE_OPTIONS` entry (icon, label, tooltip). Rewrite `ModePreview`'s highlight logic from the current binary ternary to per-mode logic — entity-first highlights row 0 including its entity cell, same visual family as row-first's row band.
- **Highlight bands** (`DataTableCell.tsx`, `ComputedCell.tsx`, `ColumnHeaderCell.tsx`, `DataTable.tsx`) — entity-first follows the row-band rule already used for row-first.
- **`ui-store.ts`** — no migration needed for the persisted `navigationMode` field; a previously-stored `'column-first' | 'row-first'` value stays valid, and the new literal rehydrates through the same setter once the type is widened (§5).

---

## 8. Data Contract

```ts
// Segmentation result (server-internal, batch-orchestrator.ts)
interface EntityGroup {
  entityText: string;
  rawValues: string[];
}

interface EntityGroupSegmentation {
  groups: EntityGroup[]; // 1–30
}
```

```ts
// lib/shared/types/voice-pipeline.ts
export type NavigationMode = 'column-first' | 'row-first' | 'entity-first';
```

No change to `VoiceEntryPayload`'s shape beyond widening the `navigationMode` field's type — the client already sends `navigationMode` as a plain string field (`use-voice-pipeline.ts`, `use-continuous-voice.ts`).

---

## 9. Out of Scope

- Values with explicit column hints mixed into the same utterance (e.g. naming a column by name rather than by position) — entity-first values are positional only, matching row-first's existing rule.
- Cross-row overflow (a group with more values than remaining columns spills into the next entity's row) — overflow is parked and reported via `overflowCount`, same as row-first today.
- Migrating or repairing the pre-existing drift in `docs/06_SMART_POINTER.md` (documents removed files `lib/navigation/column-first.ts` / `row-first.ts` and a superseded `usePointerNavigation` hook) or `docs/05_VOICE_PIPELINE.md` (documents per-mode prompt branching the code no longer does) — flagged for a separate decision, not fixed silently as part of this feature.

---

## 10. Acceptance Criteria

- [x] `NavigationMode` is defined once in `lib/shared/types/voice-pipeline.ts` and imported everywhere else; no inline re-declarations remain.
- [x] `npm run build` passes with all converted ternaries as exhaustive switches (no remaining silent-fallthrough sites). (`npx tsc --noEmit` is clean save for a pre-existing, unrelated `docs/design/vite.config.ts` error.)
- [x] A single-entity utterance (`"Dana 90 85 70"`) with the pointer at the first editable column of Dana's row writes all three values to that row in column order.
- [x] A multi-entity utterance (`"Dana 90 85 70, Yossi 70 60 55"`) resolves both entities via `matchAsync` (called once per group, not once per value) and writes both rows.
- [x] A group with more values than remaining columns reports `overflowCount` for that group and does not spill into the next group's row.
- [x] After a committed batch, the pointer lands on the last resolved entity's row at the utterance's starting column.
- [x] `NavigationModeToggle` renders a third option with a correct preview; toggling to entity-first persists across reload.
- [x] Provisional highlighting during entity-first speech locks onto the matched entity's row after the first token, not per subsequent value.

---

## 11. Implementation Order

1. Type consolidation (§5) — `NavigationMode` single source of truth, exhaustive switches. Nothing else should start before this lands and `npm run build` is clean.
2. Server segmentation (§6) — local + LLM segmentation functions, unit-tested independently of the orchestrator.
3. Server resolution (§6) — `resolveEntityFirstBatch`, wired into the mode switch, with `batch-orchestrator.test.ts` cases mirroring the existing column-first/row-first suites.
4. Client pointer + UI (§7) — strategy alias, batch-handler re-targeting, provisional-target branch, toggle UI, highlight bands.
5. Remaining doc updates (`docs/features/03_ai_table_agent.md` §5.5, `docs/04_STATE_MANAGEMENT.md`, `docs/05_VOICE_PIPELINE.md`, `docs/11_API_ROUTES.md`, `docs/08_UI_COMPONENTS.md` §2.5, `docs/features/15_realtime_voice_feedback.md`) and `docs/06_SMART_POINTER.md` §3.4 (see that chapter for the mode summary and link back here).

---

## 12. Notes for Reviewers

Entity-first is a hybrid of the two existing batch paths, not a third parallel implementation — the resolver should visibly reuse `matchAsync` and `resolveRowFirstColumnTargets` rather than duplicating their logic. The type-consolidation step (§5) is a prerequisite, not cleanup-after-the-fact: it is what turns "an unconverted ternary silently treats entity-first as column-first" from a runtime bug into a compile error.

---

*End of Entity-First Navigation Spec*
