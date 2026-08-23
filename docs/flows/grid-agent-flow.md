# Grid Agent — End-to-End Code Flow

**Spec:** `docs/features/03_ai_table_agent.md` §4 (Pillar 2)
**Purpose of this doc:** trace the actual, currently-implemented code path from UI click to DB write and back — file by file — for learning/interview prep. This is a reading map, not a new spec; if it ever disagrees with the code, the code wins.

---

## 0. The two API calls, at a glance

| Step | Route | What it does |
|---|---|---|
| 1. Turn | `POST /api/ai/grid-agent` | User sends a chat message. LLM reads/reasons via tools. Returns either a text `answer` or a `pendingAction` (proposed write) — **never writes**. |
| 2. Execute | `POST /api/ai/grid-agent/execute` | Only reached if step 1 returned a `pendingAction` and the user confirmed it in a dialog. Writes exactly what was previewed. |

This two-call split is the whole security model: **the LLM proposes, TypeScript disposes** (doc §1, principle 1). The model can never cause a DB write in the same call where it decided to make one.

---

## 1. UI layer

**`components/ai/GridChatButton.tsx`** → opens the chat panel (via `useGridChatStore`).

**`components/ai/GridChatPanel.tsx`** — the chat surface, scoped to one `tableId` prop.

- Local state: `input` (textbox), `error`.
- Global state: `useGridChatStore` (Zustand) holds `messages[]` and `pendingAction`.
- `handleSubmit()`:
  1. Appends the user's message to the store.
  2. Calls `turnMutation.mutate({ tableId, message, history: messages })` — this is a TanStack Query mutation from the hook layer.
  3. On success: if the response has `pendingAction`, it stores it (`setPendingAction`) and appends an assistant message summarizing the proposed write — this is what triggers **`GridActionConfirmDialog`** to render. Otherwise it just appends `response.answer`.
  4. Also feeds `useChatVoiceLoop` / `useSpeakResponse` for the hands-free voice variant — irrelevant to the core data flow, safe to ignore for now.
- **`GridActionConfirmDialog`** (rendered unconditionally at the bottom of the panel, reads `pendingAction` from the store) is what actually calls the execute endpoint when the user clicks confirm — via `useGridAgentExecuteMutation`.

**Key architectural point:** the panel component only renders and calls mutations. All request/response shaping lives in the hook below (single-responsibility rule from `.claude/rules/architecture.md`).

---

## 2. Client hook layer

**`lib/client/hooks/ai/use-grid-agent.ts`**

Two thin TanStack Query mutation wrappers around `fetch`:

```
useGridAgentTurnMutation()    → POST /api/ai/grid-agent          → GridAgentTurnResponse
useGridAgentExecuteMutation() → POST /api/ai/grid-agent/execute  → UpdateCellsBatchResult
```

Both go through a shared `postJson()` helper that unwraps the `{ success, data }` / `{ success, error }` envelope (per `docs/11_API_ROUTES.md`) and throws a typed `GridAgentError` on failure. No business logic here — purely a typed fetch wrapper, which is why it's allowed to live in `lib/client/` even though it's "just" plumbing (it's UI-state-shaped: React Query hook, not a service).

---

## 3. API route #1 — the turn

**`app/api/ai/grid-agent/route.ts`**

Pure HTTP transport, as its own header comment states:
1. `getAuthenticatedUser()` — 401 if not logged in.
2. `parseBody(req, GridAgentTurnRequestSchema)` — Zod-validates `{ tableId, message, history? }`. This is the *only* Zod boundary check on the way in.
3. Delegates everything else to `runGridAgentTurn()` in the service layer.
4. Maps thrown `Error` messages containing `"not found"` / `"Forbidden"` to 404/403; anything else bubbles to the generic error handler.

Notice: **no rate limiting yet** (flagged explicitly in a comment — the spec calls for 10 turns/min/user, not implemented because there's no cross-instance limiter infra).

---

## 4. Service layer — the agent loop

**`lib/server/services/ai-service/grid-agent.ts`** — `runGridAgentTurn()`

This is the heart of the agent. Step by step:

1. **Fetch table columns** via `getTableColumnsForAgent(tableId, userId)` (in `lib/server/services/ai-grid-tools.ts`). This both:
   - authorizes the user against the table (`getTableAccessContext` — throws if not found/forbidden),
   - filters to only columns the caller has access to (`filterAccessibleColumns` — role/ownership-aware column-level ACL),
   - becomes the source of truth for **valid `columnKey`s** for this whole turn.

2. **Build the message array**: system prompt (built from the column list, see §5 below) + prior `history[]` + the new user message.

3. **Agent loop, up to `MAX_TOOL_ROUNDS = 3`:**
   - Call `openai.chat.completions.create({ model: 'gpt-4o-mini', messages, tools: gridAgentTools, tool_choice: 'auto' })`.
   - Accumulate token usage.
   - If the model returns **no tool calls** → it's a final text answer. Return `{ answer, evidence? }`. (`evidence` is attached if a prior `queryGridData` call happened this turn, so the UI/user can see which rows backed the answer.)
   - If it **does** return tool calls, for each one:
     - `validateAndBuildCorrection()` — Zod-parses the tool's raw JSON args against that tool's arg schema, then checks every referenced `columnKey` against the `columnKeys` set from step 1. If invalid/unknown, a `role: 'tool'` correction message is pushed back into the conversation instead of executing — capped at `MAX_CORRECTION_ROUNDS = 2`, after which the turn bails with an apology.
     - If valid, dispatch by tool name:
       - **`queryGridData`** → `queryGridData(tableId, userId, args)` executes immediately (read-only), result appended as a `tool` message, loop continues to the next round so the model can use the result.
       - **`getGridSummary`** → same shape, read-only, executes immediately.
       - **`updateCellsBatch`** → **does not execute.** Generates an `actionId` (`randomUUID()`), builds a human-readable `summary` (`buildUpdateSummary`), stores `{ actionId, updates, tableId, userId, ... }` in `pendingGridActionCache`, and **returns immediately** with `{ pendingAction: { actionId, summary, updates } }` — ending the turn right there, no further LLM rounds.

Note `tableId` is a function parameter throughout — it is **never** part of any tool's JSON schema, so the model has no channel to smuggle in a different table (doc §4.3 "tableId ... never from LLM output").

---

## 5. Prompt + tool schema construction

**`lib/server/services/ai-service/grid-agent-prompts.ts`**

- `gridAgentTools`: the 3 OpenAI function-calling tool definitions (`queryGridData`, `updateCellsBatch`, `getGridSummary`), with JSON-Schema `parameters` generated straight from the Zod arg schemas via `z.toJSONSchema()` — one source of truth, no hand-duplicated schema.
- `buildSystemPrompt(columns)`: builds the system message, injecting only that table's `key/label/type` triples (the "context diet" from doc §2.3 — no row data, no other tables). Also encodes conversational rules (use prior turns before re-querying, format multi-row answers as markdown lists, never invent a columnKey).

---

## 6. Tool executors — DB access

**`lib/server/services/ai-grid-tools.ts`** — "pure, LLM-agnostic" functions, no OpenAI import. This is the only place that touches Prisma for this feature (per `.claude/rules/database.md`).

- **`getTableColumnsForAgent`** — auth + column-ACL-filtered `TableColumn` fetch (see §4).
- **`queryGridData(tableId, userId, args)`**:
  - Re-validates access, re-validates filter `columnKey`s (defense in depth — `UnknownColumnKeyError` if a caller bypassed the agent loop's own check).
  - Translates each `GridFilter` into a Prisma `where` clause (`buildFilterWhere` — handles `eq/neq/gt/gte/lt/lte/contains/isEmpty/isNotEmpty` against the JSON `value` column).
  - Intersects matching `rowKey` sets across multiple filters, then re-fetches full rows for those keys.
  - Resolves each row's `representativeLabel` — either from a `TableColumn` that is itself the representative column, or (for `BaseList`-bound tables) by joining `ListEntity.values` on `rowKey === ListEntity.id`.
  - Returns `{ rows: [{ rowKey, representativeLabel, cells }] }`, capped at `args.limit` (default 50, max 200 per the Zod schema).
- **`getGridSummary(tableId, userId)`** — fetches all accessible cells, computes `filled/empty` counts per column and `min/max/avg` for `NUMBER` columns, in-memory (no SQL aggregation) — fine at MVP scale per doc §6.2.
- **`executeUpdateCellsBatch(tableId, userId, updates)`** — the only writer, and it is **only called from the execute route**, never from the turn loop:
  - Re-checks table access + per-column access (`canAccessColumn`).
  - Runs each update's value through `validateValue()` (`lib/server/parsers/value-parsers.ts`) against the column's `ColumnType` and `validation` rules — invalid values are collected into `failed[]`, not written.
  - Valid writes go through `upsertCellsBatch()` (`lib/server/services/cells.ts`) — a single transaction, `entrySource: EntrySource.MANUAL` (see doc §6.3 — a future `AI` enum value is proposed but not yet implemented, so agent writes currently look identical to manual ones in the DB).
  - Returns `{ updated, failed }`.

---

## 7. The pending-action cache (the "confirmation gate")

**`lib/server/cache/grid-agent-cache.ts`**

An in-memory `LRUCache` (max 500 entries, 5-minute TTL) keyed by `actionId`, storing the *exact* proposed `updates[]` plus `tableId`/`userId` for later ownership re-check. This is what makes the confirm step trustworthy: `POST /api/ai/grid-agent/execute` never asks the LLM again — it just looks up `actionId` and replays precisely what was shown to the user.

Being in-memory, it's inherently per-server-instance and short-lived — acceptable for a "review a dialog within 5 minutes" UX, explicitly called out as a deliberate MVP tradeoff (`docs/features/03_ai_table_agent.md` §4.3).

---

## 8. API route #2 — execute

**`app/api/ai/grid-agent/execute/route.ts`**

1. Auth check.
2. Zod-validate `{ actionId }`.
3. `pendingGridActionCache.get(actionId)` — 404 if expired/missing.
4. **`cached.userId !== user.id` → 403.** This is the critical check: the action can only be executed by the user who triggered it, independent of whatever `tableId` the client might pass (it doesn't even accept one — everything comes from the cache).
5. Calls `executeUpdateCellsBatch(cached.tableId, user.id, cached.updates)`.
6. Evicts the cache entry (single-use).
7. Returns `{ updated, failed }` in the standard envelope.

---

## 9. Back to the UI

`useGridAgentExecuteMutation`'s `onSuccess` (in `GridActionConfirmDialog`, not shown above but same pattern as the turn mutation) clears the pending action from the store and — per the smart-pointer rule in `.claude/rules/voice-pipeline.md` — any TanStack Query cache for that table's cells should be invalidated so the grid UI reflects the write. Look at `GridActionConfirmDialog.tsx` directly to see the exact invalidation call if you want to trace that last hop yourself — good next file to open.

---

## 10. Full call graph (text form)

```
GridChatPanel.tsx (UI)
  └─ useGridAgentTurnMutation() [lib/client/hooks/ai/use-grid-agent.ts]
       └─ POST /api/ai/grid-agent [app/api/ai/grid-agent/route.ts]
            ├─ getAuthenticatedUser()
            ├─ Zod: GridAgentTurnRequestSchema
            └─ runGridAgentTurn() [lib/server/services/ai-service/grid-agent.ts]
                 ├─ getTableColumnsForAgent() ─┐
                 ├─ buildSystemPrompt() + gridAgentTools [grid-agent-prompts.ts]
                 ├─ openai.chat.completions.create() (loop, ≤3 rounds)
                 ├─ validateAndBuildCorrection() (Zod + columnKey check)
                 ├─ queryGridData() ────────────┼─→ lib/server/services/ai-grid-tools.ts → Prisma → TableCell/ListEntity
                 ├─ getGridSummary() ───────────┘
                 └─ updateCellsBatch → pendingGridActionCache.set() → returns { pendingAction }  [NO WRITE YET]

  (user clicks Confirm in GridActionConfirmDialog)
  └─ useGridAgentExecuteMutation()
       └─ POST /api/ai/grid-agent/execute [app/api/ai/grid-agent/execute/route.ts]
            ├─ getAuthenticatedUser()
            ├─ pendingGridActionCache.get(actionId) + ownership check
            └─ executeUpdateCellsBatch() [lib/server/services/ai-grid-tools.ts]
                 ├─ validateValue() per update [lib/server/parsers/value-parsers.ts]
                 └─ upsertCellsBatch() [lib/server/services/cells.ts] → Prisma transaction → TableCell rows written

  └─ TanStack Query cache invalidated → grid re-renders with new cell values
```

---

## 11. Things worth being able to explain in the interview

- **Why two endpoints instead of one?** So a write can never happen inside the same request where the model decided to propose it — the confirm step re-executes a cached, user-approved payload instead of trusting the model's live output.
- **Where does `tableId` authorization happen, and how many times?** `getTableAccessContext` is called independently in `getTableColumnsForAgent`, again inside `queryGridData`/`getGridSummary`, and again inside `executeUpdateCellsBatch` — defense in depth rather than trusting a single earlier check.
- **How is prompt-injection via a fabricated `columnKey` prevented?** Every tool-call argument is checked against the real `TableColumn` set fetched from Prisma before execution (`validateAndBuildCorrection`), independent of whatever the model claims.
- **Why is `updateCellsBatch` a "tool" at all if it never executes?** So the model can still reason about *which* update to propose using normal function-calling, while the execution boundary is enforced entirely in TypeScript — the "LLM proposes, TypeScript disposes" principle from doc §1.
- **What's the weakest link at MVP?** The in-memory `LRUCache` for pending actions — doesn't survive a serverless cold start/instance switch, and there's no rate limiting yet. Both are called out explicitly in code comments as known follow-ups.
