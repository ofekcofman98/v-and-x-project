# Global Agent — End-to-End Code Flow

**Spec:** `docs/features/03_ai_table_agent.md` §4 (Pillar 2) — the Global Agent is the multi-table extension of the Grid Agent design; no dedicated spec section exists yet, so this doc is the closest thing to one.
**Companion doc:** `docs/flows/grid-agent-flow.md` — read that first. The Global Agent reuses most of the Grid Agent's machinery; this doc focuses on what's shared vs. what genuinely differs.
**Purpose of this doc:** trace the actual, currently-implemented code path from UI click to DB write and back — file by file — for learning/interview prep. This is a reading map, not a new spec; if it ever disagrees with the code, the code wins.

---

## 0. The one-sentence framing

The Grid Agent is scoped to **one open table** (`tableId` is a server-side constant, never seen by the LLM). The Global Agent is scoped to **one `@BaseList` mention**, which fans out to *every* `Table` linked to that BaseList — so `tableId` becomes genuine, per-call LLM output that must be validated like any other untrusted argument. That single change (single table → BaseList-scoped set of tables) is what drives almost every other difference below.

| Step | Route | What it does |
|---|---|---|
| 1. Turn | `POST /api/ai/global-agent` | User sends a chat message with exactly one `@BaseList` mention. LLM reads/reasons via tools across every `Table` linked to that BaseList. Returns `answer` or `pendingAction` — **never writes**. |
| 2. Execute | `POST /api/ai/global-agent/execute` | Only reached if step 1 returned a `pendingAction` and the user confirmed it. Writes exactly what was previewed, to whichever table the cached action targets. |

Same two-call security model as the Grid Agent: **the LLM proposes, TypeScript disposes** (spec §1, principle 1).

---

## 1. UI layer

**`components/ai/GlobalChatButton.tsx`** — fixed-position trigger, no props, mounted once (in the dashboard layout). Opens the panel via `useGlobalChatStore(s => s.open)`.

**`components/ai/GlobalChatPanel.tsx`** — the chat surface. Unlike `GridChatPanel`, it takes **no `tableId` prop** — instead it exposes an `@Mention` text input (via the shared `useMentionInput` hook, capped at `maxMentions: 1`), because the scope *is* the mention.

- Store: `useGlobalChatStore` (Zustand, `lib/client/stores/global-chat-store.ts`) — `messages[]`, `activeMention`, `pendingAction`, `isConfirmDialogOpen`.
- `handleSubmit()`:
  1. Resolves `mention = mentions[0] ?? activeMention`; if none is set, shows a "mention a @BaseList to start" notice and bails.
  2. Appends the user message, calls `setActiveMention(mention)`.
  3. `turnMutation.mutate({ message, mentions: [mention], history: messages })`.
  4. On success: `pendingAction` in the response → store it (flips `isConfirmDialogOpen`) + append a summary message; otherwise append `response.answer`.
- **`GlobalActionConfirmDialog`**, rendered unconditionally, reads `pendingAction`/`isConfirmDialogOpen` and calls `useGlobalAgentExecuteMutation` on confirm.

**Key store difference vs. Grid Agent:** `GridChatPanel` resets its conversation implicitly by remounting per `tableId`. `GlobalChatPanel` is mounted once, globally — so `setActiveMention` **resets `messages`/`pendingAction`/`isConfirmDialogOpen` whenever the mention id changes**. Switching which `@BaseList` you're chatting about starts a fresh conversation, since the whole data scope just changed. `MAX_HISTORY = 20` messages are retained client-side.

**`GlobalActionConfirmDialog.tsx`**: on confirm, calls `useGlobalAgentExecuteMutation().mutate({ actionId })`. On success it reads `pendingAction.updates[0].tableId` and, **only if** `useTableCellStore.getState().loadedTableId` matches that table, force-refetches its cells. This "best effort" invalidation exists because the Global Agent isn't bound to any open grid page — the Grid Agent, by contrast, always knows which table is on screen and can invalidate unconditionally.

---

## 2. Client hook layer

**`lib/client/hooks/ai/use-global-agent.ts`** — same shape as `use-grid-agent.ts`:

```
useGlobalAgentTurnMutation()    → POST /api/ai/global-agent          → GlobalAgentTurnResponse
useGlobalAgentExecuteMutation() → POST /api/ai/global-agent/execute  → UpdateCellsBatchResult
```

Both go through the shared `postJson()` helper, unwrapping `{ success, data }` / `{ success, error }` and throwing a typed `GlobalAgentError` (with a `code` field) on failure. Pure typed-fetch plumbing, no business logic — same rationale as the Grid Agent hook for living in `lib/client/`.

---

## 3. API route #1 — the turn

**`app/api/ai/global-agent/route.ts`**

1. `getAuthenticatedUser()` — 401 if not logged in.
2. `parseBody(req, GlobalAgentTurnRequestSchema)` — Zod: `{ message, mentions: [exactly 1 Mention], history? }`.
3. **`getAccessibleOrganizationIds(user.id)`** — an extra step Grid Agent's route doesn't need, because a `BaseList` can be owned by a user *or* an organization, and ownership must be checked accordingly.
4. Delegates to `runGlobalAgentTurn({ userId, organizationIds, mention: body.data.mentions[0], message, history })`.
5. Same error mapping as Grid Agent: `"not found"` → 404, `"Forbidden"` → 403, else generic handler.
6. No rate limiting — same known gap as Grid Agent/Schema Agent, called out in a code comment.

---

## 4. Service layer — the agent loop

**`lib/server/services/ai-service/global-agent/agent.ts`** — `runGlobalAgentTurn(params)`

1. **`resolveMentionContext(userId, organizationIds, [mention])`** — the same "RAG on a diet" context resolver the Schema Agent uses (`lib/server/services/ai-service/shared/context.ts`); ownership-checked `BaseList` lookup (`name`, entity `count`) — no full entity rows.
2. **`prisma.table.findMany({ where: { baseListId } })`** — every `Table` linked to that `BaseList`. Zero tables → returns a plain-text `answer` immediately, no LLM call at all.
3. For each table, calls **`getTableColumnsForAgent(tableId, userId)`** — the *same* function the Grid Agent uses (`lib/server/services/ai-service/tools/grid-tools.ts`) — to get ACL-filtered columns. Builds `tables: GlobalAgentTable[]` (`{ tableId, name, columns }`) plus a `columnKeysByTable: Map<tableId, Set<columnKey>>` lookup used for validation.
4. Hands the round loop off to the **shared `runToolAgent()`** (§4b), passing:
   - `systemPrompt: buildGlobalSystemPrompt(baseListName, tables)`
   - `tools: globalAgentTools`
   - `handleToolCall` — the Global-Agent-specific validate+dispatch closure (below)
   - `buildFinalAnswer` — wraps `{ answer, evidence? }`; evidence rows here carry a `tableId` (Grid Agent's don't need to, since it's single-table)
   - canned `buildCorrectionLimitAnswer` / `buildExhaustedAnswer`
5. Returns `{ ...response, usage }`.

**`handleToolCall(name, rawArgs)`** dispatch:
- `validateAndBuildCorrection()` runs first — a string result means "correction," pushed back to the model instead of executing.
- `queryGridData` / `getGridSummary` → delegate straight to the **shared executors** in `tools/grid-tools.ts` (same functions Grid Agent calls), store the last query result (for evidence), loop continues.
- `updateCellsBatch` → **never executes.** Generates an `actionId`, stamps `tableId` onto every update, builds a summary, stores into `pendingGlobalActionCache`, returns `{ kind: 'terminate', response: { pendingAction } }` — ends the turn right there.

### The `tableId` trust boundary (the key thing to be able to explain)

Grid Agent never puts `tableId` in any tool's JSON schema — it's a closed-over server constant, so the model has no channel to smuggle in a different table. Global Agent's tools **must** expose `tableId` as a real parameter, because one turn can span multiple tables. So `validateAndBuildCorrection(toolName, rawArgs, columnKeysByTable)` does one more check than Grid Agent's equivalent:

1. Zod-parses the tool's args against its `Global*ArgsSchema`.
2. Extracts `tableId` and checks it against `columnKeysByTable` — unknown/missing `tableId` → correction listing the BaseList's actual linked tables.
3. Extracts every referenced `columnKey` and checks it against *that specific table's* column set — unknown key → correction listing valid columns for that table.
4. Returns `null` only if both checks pass.

This is the direct analogue of Grid Agent's `columnKey`-only check, extended one level because `tableId` is no longer implicit.

---

## 4b. The shared tool-calling runner

**`lib/server/services/ai-service/shared/tool-agent-runner.ts`** — `runToolAgent<TResponse>(params)`.

Both agents' round loops are identical — build messages, call `openai.chat.completions.create({ model: 'gpt-4o-mini', tools, tool_choice: 'auto' })`, accumulate token usage, and either return a final answer, push a tool result and continue, push a correction (capped), or terminate early. This was pulled out into one file (commit "Extract shared tool-calling runner for grid/global agent") so the *only* thing each agent supplies is a `handleToolCall` callback:

```ts
export type ToolCallOutcome<TResponse> =
  | { kind: 'result'; content: string }
  | { kind: 'correction'; content: string }
  | { kind: 'terminate'; response: TResponse };
```

- Grid Agent's `handleToolCall` closes over one fixed `tableId`, checks only `columnKey`.
- Global Agent's `handleToolCall` checks both `tableId` and per-table `columnKey` (above).
- Everything else — round/correction limits, the OpenAI call shape, usage accounting, message bookkeeping — lives once in this file.

Round/correction limits and the model name are now centralized in **`lib/server/services/ai-service/shared/config.ts`**:

```ts
AI_MODELS.CHAT = 'gpt-4o-mini'
AI_LIMITS.MAX_TOOL_ROUNDS = 3
AI_LIMITS.MAX_CORRECTION_ROUNDS = 2
```

(Note: `grid-agent-flow.md` describes these as if they were local constants inside a single `grid-agent.ts` file — that reflects the pre-extraction layout. Post-extraction, the constants live centrally here and the Grid Agent's own agent file has also moved under `lib/server/services/ai-service/grid-agent/`.)

Usage accounting is likewise centralized in **`shared/usage.ts`** (`AgentUsage` + `accumulateUsage()`), used identically by both agents.

---

## 5. Prompt + tool schemas

**`lib/server/services/ai-service/global-agent/prompts.ts`**

- `globalAgentTools` — the same 3 tools as Grid Agent (`queryGridData`, `updateCellsBatch`, `getGridSummary`), JSON Schema generated via `z.toJSONSchema()` from the `Global*ArgsSchema` variants. **Every tool's schema includes a required `tableId: z.uuid()`**, which Grid Agent's tool schemas don't have.
- `buildGlobalSystemPrompt(baseListName, tables)` — lists every linked table with its `tableId` and `key/label/type` columns (context diet, same principle as Grid Agent, just one level bigger). Notable additions vs. the Grid Agent prompt:
  - explicit instruction that every tool call requires a `tableId` chosen from the listed tables;
  - **cross-table join instruction**: rows across tables sharing the same `rowKey` represent the same BaseList entity — the model is told to call `queryGridData` once per relevant table and join on `rowKey` itself; there is no server-side join;
  - explanation that `representativeLabel` is resolved automatically, not a real column;
  - instruction to never ask for a `baseListId` (there's only one in scope, from the mention).

---

## 6. Tools — same three, extended arg shape

Defined once in **`lib/shared/types/ai.ts`**, each simply the Grid Agent schema `.extend({ tableId: z.uuid() })`:

| Tool | Shape | Read/Write | Produces `pendingAction`? |
|---|---|---|---|
| `queryGridData` | `{ tableId, filters: GridFilter[] (max 10), limit (1–200, default 50) }` | Read-only | No |
| `getGridSummary` | `{ tableId }` | Read-only | No |
| `updateCellsBatch` | `{ tableId, updates: CellUpdate[] (1–100) }` | Write (proposal only) | **Yes** — always ends the turn |

The operator set (`eq/neq/gt/gte/lt/lte/isEmpty/isNotEmpty/contains`) is the same shared `GridFilterOperatorSchema` Grid Agent uses.

**Executors are literally shared** — `lib/server/services/ai-service/tools/grid-tools.ts`'s `getTableColumnsForAgent`, `queryGridData`, `getGridSummary`, `executeUpdateCellsBatch` all take `tableId` as an explicit parameter by design; the file's own header comment says this was done specifically so a future multi-table BaseList agent could reuse it without refactoring. Global Agent is that consumer — no duplicate DB logic exists for it.

---

## 7. DB access per tool (all via the shared executors)

- `getTableColumnsForAgent` → `getTableAccessContext` (auth) + `prisma.tableColumn.findMany` filtered by `filterAccessibleColumns` (column ACL).
- `queryGridData(tableId, userId, args)` → re-checks access, translates filters to `prisma.tableCell.findMany` predicates, intersects matched `rowKey`s across filters, re-fetches full rows, resolves `representativeLabel` (real column, or `prisma.listEntity` lookup for BaseList-bound tables).
- `getGridSummary(tableId, userId)` → fetches all accessible cells, computes `filled/empty`/`min/max/avg` in memory.
- `executeUpdateCellsBatch(tableId, userId, updates)` (execute route only) → per-column ACL + `validateValue()` per `ColumnType`, then `upsertCellsBatch()` (`lib/server/services/cells.ts`) — one transaction, `entrySource: EntrySource.MANUAL`.
- Additionally, at context-resolution/loop-setup time: `prisma.baseList.findFirst` (ownership-scoped), `prisma.listEntity.count`, `prisma.table.findMany({ where: { baseListId } })`.

Models touched overall: `BaseList`, `ListEntity`, `Table`, `TableColumn`, `TableCell`.

---

## 8. The pending-action cache

**`lib/server/cache/global-agent-cache.ts`** — `pendingGlobalActionCache`, an `LRUCache` (`max: 500`, `ttl: 5 min`) — same config as Grid Agent's cache, but **deliberately a separate keyspace**, so `actionId`s never collide between the single-table Grid Agent and this multi-table Global Agent (explicit comment in the source).

Stores `{ actionId, updates: GlobalCellUpdate[] (each carrying its own tableId), userId, ... }`. Ownership re-check (`userId !== user.id → 403`) happens in the execute route, same pattern as Grid Agent.

---

## 9. API route #2 — execute

**`app/api/ai/global-agent/execute/route.ts`**

1. Auth check.
2. Zod-validate `{ actionId }`.
3. `pendingGlobalActionCache.get(actionId)` — 404 if expired/missing.
4. `cached.userId !== user.id` → 403.
5. **`const tableId = cached.updates[0]?.tableId`** — 404 ("Action has no target table") if absent. This is the one genuinely different step from Grid Agent's execute route: since there's no route-level `tableId`, the target table is derived from the cached payload itself (all updates in one action come from the same tool call, hence the same table).
6. Strips `tableId` off each update and calls the **shared** `executeUpdateCellsBatch(tableId, user.id, updates)` — the exact function Grid Agent's execute route calls.
7. Evicts the cache entry (single-use), returns `{ updated, failed }`.

---

## 10. Back to the UI

`useGlobalAgentExecuteMutation`'s `onSuccess` clears the pending action and appends a result summary. Unlike Grid Agent (always-visible table → unconditional invalidation), `GlobalActionConfirmDialog` only force-refetches cells if the currently loaded table (`useTableCellStore.getState().loadedTableId`) happens to match the write's target table — a deliberate "best effort" compromise since the Global Agent panel is app-wide, not page-scoped.

---

## 11. Full call graph (text form)

```
GlobalChatButton.tsx → useGlobalChatStore.open()
GlobalChatPanel.tsx (UI, @Mention input via useMentionInput)
  └─ useGlobalAgentTurnMutation() [lib/client/hooks/ai/use-global-agent.ts]
       └─ POST /api/ai/global-agent [app/api/ai/global-agent/route.ts]
            ├─ getAuthenticatedUser()
            ├─ getAccessibleOrganizationIds(user.id)
            ├─ Zod: GlobalAgentTurnRequestSchema
            └─ runGlobalAgentTurn() [lib/server/services/ai-service/global-agent/agent.ts]
                 ├─ resolveMentionContext() [shared/context.ts] → BaseList ownership + metadata
                 ├─ prisma.table.findMany({ baseListId }) → linked tables
                 ├─ getTableColumnsForAgent() per table [tools/grid-tools.ts] → columnKeysByTable map
                 ├─ buildGlobalSystemPrompt() + globalAgentTools [global-agent/prompts.ts]
                 └─ runToolAgent() [shared/tool-agent-runner.ts]   ← SHARED with grid-agent
                      ├─ openai.chat.completions.create() (loop, ≤3 rounds, AI_LIMITS)
                      ├─ handleToolCall() [global-agent/agent.ts closure]
                      │    ├─ validateAndBuildCorrection() — Zod + tableId + per-table columnKey check
                      │    ├─ queryGridData(tableId,...) ──┐
                      │    ├─ getGridSummary(tableId,...) ─┼─→ tools/grid-tools.ts → Prisma → TableCell/ListEntity
                      │    └─ updateCellsBatch → pendingGlobalActionCache.set() → { kind: 'terminate', pendingAction }
                      └─ usage accumulation [shared/usage.ts]

  (user clicks Confirm in GlobalActionConfirmDialog)
  └─ useGlobalAgentExecuteMutation()
       └─ POST /api/ai/global-agent/execute [app/api/ai/global-agent/execute/route.ts]
            ├─ getAuthenticatedUser()
            ├─ pendingGlobalActionCache.get(actionId) + ownership check
            ├─ tableId = cached.updates[0].tableId
            └─ executeUpdateCellsBatch(tableId, userId, updates) [tools/grid-tools.ts]   ← SHARED with grid-agent
                 ├─ validateValue() per update [lib/server/parsers/value-parsers.ts]
                 └─ upsertCellsBatch() [lib/server/services/cells.ts] → Prisma tx → TableCell rows written

  └─ Best-effort: if loadedTableId === targetTableId, useTableCellStore.fetchCells(force)
```

---

## 12. Things worth being able to explain in the interview

- **Why does the Global Agent need to validate `tableId` when the Grid Agent doesn't?** Because Grid Agent scopes to one table server-side (a closure constant never exposed in any tool schema), while Global Agent spans every table linked to a BaseList — so `tableId` genuinely comes from the model each tool call, and must be checked against the actual set of linked tables just like `columnKey` is checked against actual columns.
- **What's actually shared between the two agents, and what forced the split?** The round loop, OpenAI call, usage accounting, and message bookkeeping are one function (`runToolAgent`) since they're identical. The tool *executors* (`queryGridData`, `getGridSummary`, `executeUpdateCellsBatch`) are also shared, because they were designed from the start to take `tableId` as an explicit parameter. What differs is only the validation-and-dispatch closure each agent supplies, and the prompt/tool-schema construction (extra `tableId` field, cross-table join instructions).
- **How does the write path stay safe with multiple tables in scope?** Same two-call split as Grid Agent — `updateCellsBatch` never executes inside the turn; it's cached by `actionId` and replayed verbatim on confirm. The multi-table wrinkle is that the *target* table for execution is derived from the cached action's own updates (`cached.updates[0].tableId`), not a route parameter, since the execute route has no other way to know which table was meant.
- **Why are the two pending-action caches kept separate (`pendingGridActionCache` vs. `pendingGlobalActionCache`)?** So `actionId`s can never collide between a single-table and multi-table agent — an explicit design choice, not an accident of file layout.
- **What's the weakest link at MVP, same as Grid Agent?** In-memory `LRUCache` for pending actions (doesn't survive a serverless cold start), no rate limiting yet. The Global Agent also adds a UX-level weak spot: the "best effort" cell invalidation on confirm only refreshes the grid if that table happens to be the one currently open.
