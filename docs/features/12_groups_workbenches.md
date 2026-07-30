# Workbenches & Groups — Hierarchical Aggregation, Bulk Templates & Sharing

**Feature:** 12 — Workbenches & Groups
**Priority:** Medium
**Dependencies:** 03_DATABASE.md, 03_ai_table_agent.md, 13_ux_ia_redesign.md, `prisma/schema.prisma`
**Status:** Phase 1 (Schema & Core CRUD) implemented — Phases 2–4 not started
**Last Updated:** 2026-07-30

> **Note on this file's history:** this document previously covered five loosely-related frontier ideas (Unified Canvas, Blueprint Hub, `@mention`, Token Delta Optimization, a local MCP dev server). The Unified Canvas, `@mention`, and Token Delta Optimization ideas have since **shipped** — as the Library page + live-canvas create-table flow (`13_ux_ia_redesign.md`) and the Schema Agent's `@Mention` resolution and context-diet design (`03_ai_table_agent.md`). This file is repurposed to spec the next planned feature, **Workbenches & Groups**, which `13_ux_ia_redesign.md` flagged as future scope but never designed. The two ideas that hadn't shipped and aren't superseded — the Blueprint Hub and the local MCP dev server — are carried forward unchanged in §6–7.
>
> **Revision note:** an earlier draft of this spec treated "Group" and "Workbench" as one interchangeable concept with a single flat (non-nested) container model. Product discussion clarified these are two distinct concerns — see §1.2 — and this draft replaces that model with a three-level hierarchy.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Data Model](#2-data-model)
3. [API Routes](#3-api-routes)
4. [Authorization Model](#4-authorization-model)
5. [UI/UX Integration](#5-uiux-integration)
6. [The Blueprint Hub (Zero-Token Initialization)](#6-the-blueprint-hub-zero-token-initialization)
7. [Local Development Tooling: Custom MCP Server](#7-local-development-tooling-custom-mcp-server)
8. [Implementation Milestones & Phasing](#8-implementation-milestones--phasing)

---

## 1. Executive Summary

### 1.1 The Problem

Base Lists are deliberately flat and simple (`13_ux_ia_redesign.md` § Future Hierarchy) — a user saves a roster once and reuses it, with no concept of "these lists belong together," and no concept of "this whole area of my work has nothing to do with that other area." That breaks down for three real scenarios:

- **Bulk template application.** A teacher with `Class_A1`, `Class_A2`, `Class_A3` as three separate Base Lists wants to apply the "Exam" Column Template to all three at once (§3.4). Today this means three separate visits to `Apply Template` per list.
- **Scoped sharing.** A user wants to share a *subset* of their lists with a specific collaborator — e.g. a school principal sharing only "Grade 1" with an HR contact, not the whole organization, and not each list individually. Today, sharing only exists at the `Organization` level (all-or-nothing membership) or not at all for personal (non-org) resources.
- **Unrelated contexts, real hierarchy.** A manager has entirely separate areas of responsibility — Classes, Suppliers, Teachers, Parents — that should never mix in the same tree, search, or view, and *within* one of those areas the natural structure is genuinely nested (e.g. Classes → Grade 1 / Grade 2 → Class 1A / Class 1B).

### 1.2 The Solution — two distinct concepts, not one

Earlier product discussion used "Group" and "Workbench" interchangeably. They're not the same thing, and conflating them was a mistake this revision corrects:

- A **Workbench** is a top-level, unrelated context — a switchable workspace. "Classes" and "Suppliers" are different Workbenches: nothing in one should ever appear alongside the other in a tree, a search, or a bulk action. A user (or org) has a small number of these, and moves between them the way you'd switch between projects.
- A **Group** is the nested organizing unit *inside* a Workbench, and Groups can contain other Groups (a real tree, not one flat level). Inside the "Classes" Workbench: a Group per grade level (`Grade 1`, `Grade 2`), each containing Groups per class (`Class 1A`, `Class 1B`), each containing `BaseList`s.

So the real hierarchy is:

```
Workbench  (top-level, mutually unrelated contexts — "Classes", "Suppliers", "Teachers", "Parents")
  └─ Group  (nestable — "Grade 1" → "Class 1A" → ...)
       └─ Group  (a Group can contain child Groups, arbitrarily deep)
            └─ BaseList  (leaf level — unchanged, still the actual roster of entities)
```

- Every `BaseList` (and every `Group`) belongs to exactly one Workbench, directly or transitively through its parent Group — this is what keeps "Classes" and "Suppliers" from ever bleeding into each other.
- Exposes one bulk action, **apply a Column Template to every list under a Group** (recursively, including all descendant Groups) — implemented as an orchestration loop over the existing single-list `applyTemplateToBaseList`, no new merge/dedup logic, no change to the app's strict 1 Table : 1 BaseList invariant (`13_ux_ia_redesign.md` Decision 4). Applying "Exam" to the Group `Grade 1` (containing Class 1A/1B, each with their own lists) produces one table per list, exactly as if the user had applied it manually to each one.
- Sharing happens at both levels: a Workbench can be shared wholesale (e.g. an assistant who needs all of "Classes"), or a single nested Group can be shared on its own (e.g. an HR contact who should only see "Suppliers → Contracts", not the rest of that Workbench) — see §2 and §4.

### 1.3 Example Scenarios (from product discussion)

- **Teacher, single manager of their own lists:** creates a Workbench `Classes`, with Groups `Class_A1`/`A2`/`A3` (or a `Grade 1` Group containing those as children — either shape works, see §2), applies "Exam" once at whatever Group level covers all three instead of three times.
- **Manager with several unrelated workbenches:** has Workbenches `Teachers`, `Classes`, `Suppliers`, `Parents` — genuinely independent contexts a user switches between (§5), each internally organized into as many nested Groups as makes sense for that domain.
- **Scoped external sharing:** a Workbench or Group owner adds a membership row for a specific user+role, scoped to only that node and its descendants, without that user ever joining the owner's `Organization` or gaining access to sibling Workbenches/Groups.

### 1.4 Explicitly Deferred (not in this doc's scope)

- **A merged multi-list Table.** Applying a template to a Group always produces one Table per descendant `BaseList` (§1.2), never a single combined table. Merging would violate the 1 Table : 1 BaseList invariant and needs its own design if ever pursued.
- **Groups/Workbenches containing Tables or Column Templates directly.** v1 Groups aggregate `BaseList`s (and child Groups) only. A Table is reachable transitively (via the lists it was created from); a Column Template is applied *to* a Group, not stored *in* one.
- **Moving a Group between Workbenches, or re-parenting across the tree, as a first-class UI flow.** The schema supports it (it's just updating a foreign key), but a dedicated "move" UI/UX is out of scope for the initial phases — see §8 Phase 4.

---

## 2. Data Model

Four new Prisma models. All are **additive** — no existing model's columns change, and `BaseList`/`Table`/`ColumnTemplate` remain valid and functional with zero Workbench/Group membership, per the existing "additive, non-breaking migration" pattern already used for `03_ai_table_agent.md` §6.3.

> Per `.claude/rules/database.md`: this is a proposed schema addition and does not ship without explicit approval and a corresponding `docs/03_DATABASE.md` update. Field names below mirror existing sibling models as closely as possible (`Organization`/`OrganizationMember`) so the migration is a known, low-risk pattern rather than a novel one.

```prisma
model Workbench {
  id             String   @id @default(uuid())
  name           String                       // "Classes", "Suppliers", "Teachers", "Parents"
  description    String?
  userId         String                       // owner
  organizationId String?                      // optional org scoping, mirrors BaseList/Table/ColumnTemplate
  settings       Json?                        // availability/visibility config, mirrors Organization.settings
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  groups         Group[]                      // top-level Groups directly under this Workbench
  members        WorkbenchMember[]

  @@map("workbenches")
}

model Group {
  id             String   @id @default(uuid())
  workbenchId    String                       // every Group belongs to exactly one Workbench, even if nested deep
  parentGroupId  String?                      // null = top-level Group directly under the Workbench
  name           String
  description    String?
  settings       Json?                        // per-Group override, falls back to Workbench.settings if null

  workbench      Workbench @relation(fields: [workbenchId], references: [id], onDelete: Cascade)
  parentGroup    Group?    @relation("GroupChildren", fields: [parentGroupId], references: [id], onDelete: Cascade)
  childGroups    Group[]   @relation("GroupChildren")
  baseLists      GroupBaseList[]
  members        GroupMember[]

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("groups")
}

model GroupBaseList {
  groupId    String
  baseListId String
  addedAt    DateTime @default(now())

  group      Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  baseList   BaseList @relation(fields: [baseListId], references: [id], onDelete: Cascade)

  @@id([groupId, baseListId])
  @@map("group_base_lists")
}

model WorkbenchMember {
  workbenchId String
  userId      String
  role        OrgRole   // reuses the existing enum — OWNER | ADMIN | EDITOR | VIEWER
  addedAt     DateTime  @default(now())

  workbench   Workbench @relation(fields: [workbenchId], references: [id], onDelete: Cascade)

  @@id([workbenchId, userId])
  @@map("workbench_members")
}

model GroupMember {
  groupId   String
  userId    String
  role      OrgRole   // reuses the existing enum
  addedAt   DateTime  @default(now())

  group     Group     @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@id([groupId, userId])
  @@map("group_members")
}
```

**Design notes:**

- **Why `Group.workbenchId` is denormalized onto every Group, not just the top-level ones:** without it, answering "does this deeply-nested Group belong to the Classes or Suppliers workbench" requires walking `parentGroupId` all the way up on every access check. Storing `workbenchId` directly on every Group (set once at creation from the parent, immutable after unless an explicit re-parent action changes it) keeps every authorization and listing query a flat `WHERE workbenchId = ...`, no recursive CTE needed for the common case.
- **Nesting depth:** the schema places no hard limit (self-referencing `parentGroupId` supports arbitrary depth), but the service layer should enforce a sane cap (recommend **5 levels**) to keep recursive listing/UI queries bounded — matches the app's general pattern of soft caps enforced in code, not the schema (e.g. batch voice entry's 30-entry cap, Grid Agent's 100-cell cap).
- `GroupBaseList` mirrors `BaseListTemplate` (`base_list_templates`: `baseListId, templateId, autoSync, appliedAt`) — the existing precedent for "join table linking a container concept to a BaseList." No `autoSync` equivalent needed; it's just "is this list currently in this group."
- `WorkbenchMember` / `GroupMember` both mirror `OrganizationMember` field-for-field, scoped to their respective container instead of `organizationId`, and both reuse `OrgRole` rather than introducing new enums — one role vocabulary across the app. Having both (rather than only `WorkbenchMember`) is what makes "share just this one nested Group, not the whole Workbench" possible (§1.2's Suppliers→Contracts example).
- `settings: Json?` exists at both levels; a Group's `null` settings fall back to its Workbench's — mirrors how `Organization.settings` already works, extended with one level of override.
- No changes to `BaseList`, `Table`, or `ColumnTemplate` — a `BaseList` gains an implicit reverse relation (`groups: GroupBaseList[]`) but nothing about how it's queried today changes.

---

## 3. API Routes

All routes follow the standard envelope (`{ success, data }` / `{ success, error }`, `docs/11_API_ROUTES.md`) and live behind the same auth pattern as existing resource routes (`getAuthenticatedUser`, ownership/membership checks before any read or write).

| Route | Purpose |
|---|---|
| `POST /api/workbenches` | Create a Workbench (`name`, `description?`, `organizationId?`) |
| `GET /api/workbenches` | List Workbenches the user can access |
| `GET /api/workbenches/:id` | Workbench detail — top-level Groups + `WorkbenchMember`s |
| `PATCH /api/workbenches/:id` | Update `name`/`description`/`settings` |
| `DELETE /api/workbenches/:id` | Delete the Workbench (cascades to all descendant Groups/members — never the underlying `BaseList`s) |
| `POST /api/workbenches/:id/members` | `{ userId, role }` — add/update a Workbench-wide member |
| `DELETE /api/workbenches/:id/members/:userId` | Remove a Workbench-wide member |
| `POST /api/groups` | Create a Group — `{ workbenchId, parentGroupId?, name, description? }`; `parentGroupId` omitted = top-level under the Workbench |
| `GET /api/groups/:id` | Group detail — child Groups, member `BaseList`s, `GroupMember`s |
| `GET /api/groups/:id/tree` | Full recursive subtree (child Groups + their lists), for rendering the Library page's expandable tree in one call instead of N |
| `PATCH /api/groups/:id` | Update `name`/`description`/`settings`, or re-parent via `parentGroupId` (§1.4 — schema supports it, dedicated re-parent UX deferred) |
| `DELETE /api/groups/:id` | Delete the Group (cascades to child Groups/members only — never the underlying `BaseList`s) |
| `POST /api/groups/:id/lists` | `{ baseListId }` — add a list to the group |
| `DELETE /api/groups/:id/lists/:baseListId` | Remove a list from the group |
| `POST /api/groups/:id/members` | `{ userId, role }` — add/update a member scoped to just this Group |
| `DELETE /api/groups/:id/members/:userId` | Remove a member |
| `POST /api/groups/:id/apply-template` | Bulk-apply a Column Template to every `BaseList` under this Group, recursively through child Groups (§3.1) |

### 3.1 Bulk Apply-Template — `POST /api/groups/:id/apply-template`

Reuses `lib/server/services/base-list-service.ts`'s existing `applyTemplateToBaseList({ userId, organizationIds, baseListId, templateId, autoSync, selectedBaseListColumnIds })` — called once per `BaseList` reachable under the target Group, **including lists belonging to any nested child Group** (a recursive collect-then-apply, not just the Group's direct members). No new merge logic; this route is an orchestration layer only.

```json
// Request
{
  "templateId": "9f1c...-uuid",
  "autoSync": false,
  "selectedBaseListColumnIds": []
}

// Response
{
  "success": true,
  "data": {
    "results": [
      { "baseListId": "a1...", "baseListName": "Class_1A", "groupPath": "Grade 1 / Class 1A", "status": "created", "tableId": "t1..." },
      { "baseListId": "a2...", "baseListName": "Class_1B", "groupPath": "Grade 1 / Class 1B", "status": "created", "tableId": "t2..." },
      { "baseListId": "a3...", "baseListName": "Class_2A", "groupPath": "Grade 2 / Class 2A", "status": "failed", "error": "Template already applied with conflicting column key" }
    ],
    "createdCount": 2,
    "failedCount": 1
  }
}
```

**Execution semantics:**

- Each list's `applyTemplateToBaseList` call runs in its own `$transaction` (matching the existing single-list route's behavior) — a single list's failure does **not** roll back or block the others. Mirrors the deterministic-guardrails philosophy from `03_ai_table_agent.md` §1.1 (partial-success surfaced, never silently swallowed or all-or-nothing).
- `groupPath` in the response (the chain of Group names from the target Group down to the list's immediate parent) exists specifically because the target Group may be several levels above the actual list — without it, a result row for a deeply-nested list would be unattributed.
- Max lists collected recursively for one bulk-apply call: 50 (soft cap, consistent with the app's other batch caps).

---

## 4. Authorization Model

Extends the existing `getAccessibleOrganizationIds(userId)` / `ownershipWhere(userId, organizationIds)` pattern (`lib/server/services/auth.ts`) with two additional, layered access paths — a user can access a **Group** if **any** of:

1. They are the Group's Workbench's `userId` (owner).
2. The Workbench has an `organizationId` and the user is an `OrganizationMember` of that org with sufficient `OrgRole`.
3. The user has a `WorkbenchMember` row on the Group's Workbench (grants access to every Group in that Workbench).
4. The user has a `GroupMember` row on this **specific** Group, or on any of its ancestor Groups (a member of the parent Group can see/act on its children; the reverse is not true — a child-Group member does not gain access to siblings or the parent).

Path 4 is what makes "share just this one nested Group, not the whole Workbench or its other branches" possible (the Suppliers → Contracts example from §1.2), without requiring `WorkbenchMember` at all.

Implementation-wise: `getAccessibleWorkbenchIds(userId)` and `getAccessibleGroupIds(userId)` helpers alongside the existing `getAccessibleOrganizationIds`. Because Group access must account for ancestor-level membership (path 4), resolving "can this user access Group X" requires walking up `parentGroupId` (or, cheaper: precomputing an ancestor-path array/materialized path column on `Group` at write time — an implementation optimization to decide during Phase 1, not a schema change visible to callers).

Bulk apply-template (§3.1) additionally requires the acting user to have write access (`EDITOR` role or above, or ownership) on **every** `BaseList` collected from the target Group's subtree — a `VIEWER`-role member can see the tree but not trigger writes across lists they may not otherwise own.

---

## 5. UI/UX Integration

Per `13_ux_ia_redesign.md`'s note that the Library page's index/detail shell "is deliberately generic ... so it can absorb the future Workbenches/Groups hierarchy ... without restructuring the page":

- **Workbenches are the top-level switcher**, not a nested tree node — a picker (dropdown or tab strip) above the existing Lists/Templates tab toggle, since a Workbench represents a genuinely separate context the user moves between (§1.2). Switching Workbenches changes what the Lists tab's index pane shows entirely.
- **Groups render as the nested tree** inside the active Workbench's Lists tab — each Group is an expandable node (fetched via `GET /api/groups/:id/tree` to avoid N+1 calls), child Groups nested arbitrarily deep, `BaseList`s as the tree's leaves. This resolves the previous draft's open UI question (whether Groups get their own tab) — they don't; Workbench is the tab-equivalent switcher, Group is the tree inside it.
- Selecting a **Group** itself (not a leaf list) renders a Group detail pane on the right — same master-detail pattern as a single list/template — showing: descendant list count (recursive), an **"Apply template to group…"** action (opens the existing `ApplyTemplateDialog`, routed to `POST /api/groups/:id/apply-template`, with per-list `groupPath` results rendered as a flat confirmation list), child-Group management (add/rename/delete), and a **Members** section for this Group specifically.
- Selecting a **Workbench** (e.g. clicking its name in the switcher, or a dedicated "Workbench settings" affordance) renders Workbench-level settings + its `WorkbenchMember` roster.
- "+ New workbench" and "+ New group" (context-sensitive — "new top-level group" vs. "new child group under the selected node") sit alongside the existing "+ New list" button.

---

## 6. The Blueprint Hub (Zero-Token Initialization)

*(Carried forward unchanged from the previous version of this doc — not yet implemented, not superseded by anything shipped since.)*

**The Problem:** Asking an LLM to generate table structural frameworks from scratch every time introduces latency, risks hallucinations, and wastes input/output tokens.

**The Solution:** Create a visual Modal/Dialog Grid featuring rigid pre-set configurations (Blueprints) geared towards non-technical personas (e.g., Attendance Roster, Recipe/Ingredient Checklist, Quick Sticky Notes, Inventory Ledger).

**Performance & Cost Engineering:**

- Clicking a template generates the columns and row structures entirely client-side using hardcoded local schemas (0ms latency, 0% LLM token expenditure).
- The LLM (GPT-4o-mini) is completely bypassed during table creation and is only invoked later when the user utilizes voice commands to asynchronously fill or edit cells inside that structured template.

---

## 7. Local Development Tooling: Custom MCP Server

*(Carried forward unchanged from the previous version of this doc — not yet implemented, not superseded by anything shipped since.)*

**Feature Description:** Build a localized Model Context Protocol (MCP) server built on TypeScript that directly interfaces with the Prisma client / Supabase database instance.

**Usage Context:** Once loaded locally into Cursor or Claude Desktop, the developer can type direct instructions in the side-chat (e.g., "Claude, clear out any empty rows in my active local test grid" or "Reset the embedding vectors for list ID 5"). The LLM will securely call the exposed server tools to safely mutate the database state instantly during developer cycles.

---

## 8. Implementation Milestones & Phasing

### Phase 1 — Schema & Core CRUD ✅ Implemented 2026-07-30

- [x] `Workbench`, `Group`, `GroupBaseList`, `WorkbenchMember`, `GroupMember` Prisma models + migration (`20260730091130_add_workbenches_groups`)
- [x] `lib/server/services/workbench-service.ts` and `group-service.ts`: create/list/get/update/delete, add/remove list, add/remove/update member, recursive tree fetch
- [x] `getAccessibleWorkbenchIds(userId)` + `getAccessibleGroupIds(userId)` (ancestor-aware, §4) in `lib/server/services/auth.ts`
- [x] Ancestor-lookup strategy decided: recursive `parentGroupId` BFS walk at read time (not a materialized path), capped at `GROUP_MAX_DEPTH` (5)
- [x] `app/api/workbenches/**` and `app/api/groups/**` routes with Zod validation + auth
- [x] Route-level tests for the core CRUD endpoints (auth/validation/error-mapping paths); member/list sub-routes follow the identical pattern

### Phase 2 — Bulk Apply-Template

- [ ] `POST /api/groups/:id/apply-template` — recursive subtree collection, orchestration loop over `applyTemplateToBaseList`, per-list transaction, partial-success response shape with `groupPath` (§3.1)
- [ ] Write-access check across every collected list before executing (§4)
- [ ] Integration tests: mixed success/failure across a nested subtree, 50-list recursive cap enforcement

### Phase 3 — Library Page UI Integration

- [ ] Workbench switcher above the Lists/Templates tab toggle
- [ ] Recursive Group tree in the Lists tab's index pane (via `GET /api/groups/:id/tree`), expandable nodes, `BaseList`s as leaves
- [ ] Group detail pane: descendant count, "Apply template to group…" + per-list result rendering, child-Group management, Members section
- [ ] Workbench detail/settings pane + Workbench-level Members section
- [ ] "+ New workbench" / "+ New group" (context-sensitive on selected tree node)

### Phase 4 — Sharing & Re-parenting Polish

- [ ] Member invite flow (by email → resolves to `userId`, sets initial `role`) at both Workbench and Group levels
- [ ] Dedicated re-parent/move UI for Groups (schema already supports changing `parentGroupId`; deferred UX per §1.4)
- [ ] `Workbench.settings` / `Group.settings` concrete shape once a first real availability/visibility use case exists

### Exit Criteria per Phase

| Phase | Done when |
|---|---|
| 1 | A user can create a Workbench, nest Groups arbitrarily deep inside it, add/remove Base Lists and members at either level via API, and access control correctly reflects all four authorization paths (§4), including inheritance from ancestor Groups |
| 2 | Applying a template to a Group with nested child Groups produces one correctly-linked table per descendant list, attributed by `groupPath`; a deliberately-broken list anywhere in the subtree fails independently without blocking the others |
| 3 | A user can switch Workbenches, build a nested Group tree, and bulk-apply a template entirely from the Library page with no route change |
| 4 | A Group owner can share one nested Group with an outside (non-org, non-Workbench-member) user by role, and that user's access is correctly scoped to only that Group and its descendants |

---

*End of Workbenches & Groups Spec*
