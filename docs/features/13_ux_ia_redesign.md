# Information Architecture Redesign — Task-First Navigation

**Priority:** High
**Dependencies:** 02_column_templates.md, 11_perf_and_navigation.md, 14_PRODUCT_DATA_FLOW.md
**Status:** Approved direction — Library page layout (§ Library Page) pending final visual pass; core flow, IA, and 1:1 table/base-list relationship confirmed

---

## Overview

The current IA promotes three backend data models — Base Lists, Tables, Column Templates — into three peer-level, independently-navigable sections, each with its own dashboard, creation flow, and detail page. That's correct for the schema (`docs/03_DATABASE.md`) but wrong for the user, who doesn't think in those objects and has to learn all three before creating a single usable table.

**Current path to a usable table (4 pages, schema design detour, zero voice input):**
1. Dashboard → Base Lists → Create New List → define columns → Save
2. Dashboard → Base Lists (or Tables) → Create Table
3. Pick a Base List, optionally a Column Template, define more columns → Save
4. Tables → View Table → data grid finally appears

This directly undercuts the product's own pitch ("Fill spreadsheets with your voice") — the setup tax is paid entirely in forms, before a single word is spoken.

**User Story:**
- A teacher wants a grade sheet for her class. She should be able to say or type "grade table for my Class A1 students, columns Test1, Test2, FinalGrade" and land in a working grid — not learn what a Base List is first.
- A returning user reuses an existing entity list (e.g. "Class A1") across a new table without visiting a separate "Base Lists" section to do it.

**Impact:**
- Removes ~2 of 4 pages from the create-a-table critical path.
- Collapses three navigation vocabularies ("Back to Lists/Tables/Templates", global "Tables" link, per-card "View X" buttons) into one.
- Templates and Base Lists become *steps and reusable assets discovered inline*, not destinations a new user must understand up front.

---

## Proposed IA

### Before (current — 3 peer sections)

```
Dashboard
├── Base Lists  (dashboard → create → detail)
├── Tables      (dashboard → create → detail)
└── Column Templates (dashboard → create → detail)
```

Every section has its own full CRUD surface. A user must know all three exist and how they relate before creating anything.

### After (proposed — 1 primary surface, 2 supporting drawers)

```
Dashboard
└── Tables (primary surface — this is "the app")
    ├── Table detail (data grid — unchanged, this page already works well)
    └── Create Table (single flow, described below)
        ├── "Reuse entities" drawer   ← was: Base Lists section
        └── "Reuse columns" drawer    ← was: Column Templates section
```

- **Tables** becomes the only top-level destination. It's the thing users came to use.
- **Base Lists** stops being a section you visit to "manage entity lists" in the abstract. It becomes a *picker* inside table creation ("Use existing entities" → search/select an existing list, or "New list" inline) plus a lightweight management view reachable from there ("Manage saved lists") for power users who want it.
- **Column Templates** stops being a section you browse before you have any tables to justify reuse. It becomes a *save-and-reuse prompt* that appears the first time a user finishes defining columns twice ("Save these columns as a template for next time?") — opt-in, contextual, not front-loaded.

This mirrors how Notion/Airtable/Linear surface "views" and "templates": as an assist inside the primary flow, not a co-equal nav destination.

**Future hierarchy (not in scope for this doc, but shapes the design below):** Base Lists are intentionally kept simple and flat today — quick, reusable rosters a user saves once instead of rebuilding every time. The long-term vision is **Workbenches/Groups** that aggregate multiple lists with their own permission structures, in a nested hierarchy (e.g. `School A → Teachers / Grade Levels → Class 1A, Class 1B`). Nothing in this doc should assume Base Lists stay a flat, unnested list forever — see the Library page design below for why a left-index/right-detail shell was chosen partly because it can grow a tree without a page redesign.

---

## New Create-Table Flow — Live Canvas

Replaces `TableCreation.png`'s sidebar-form layout with a **live table canvas**: the creation surface *is* the table grid taking shape, not a form that produces a table you see afterward. Rows come from the side, columns come from the top.

```
┌───────────────────────────────────────────────────────────┐
│  New Table            [Describe it (AI draft) ✨]  [Create]│
├───────────┬─────────────────────────────────────────────┤
│ Base Lists│  Templates:  [Attendance] [Exam] [+ New]      │
│ (rows)    ├─────────────────────────────────────────────┤
│           │                                               │
│ ○ Class A1│   ┌───────────┬────────┬────────┬──────────┐ │
│ ○ Names   │   │ Full Name │  Q1    │  Q2    │  + col   │ │
│ ○ Test    │   ├───────────┼────────┼────────┼──────────┤ │
│           │   │  (empty — pick a base list to preview   │ │
│ + New list│   │   rows, click a template to add columns)│ │
│           │   └───────────┴────────┴────────┴──────────┘ │
└───────────┴─────────────────────────────────────────────┘
```

**Primary interaction — click, not drag:**
- Click a Base List in the left rail → its entities populate the table's rows immediately (single-select, since a table links to exactly one Base List — see open question 4).
- Click a Template chip in the top rail → its full column set is injected into the grid at once (a template is a *set* of columns, not one column each — clicking "Exam" adds Q1–Q4 together, not one at a time).
- A visible **"+ Add column"** control stays directly in the grid header at all times, so a user with zero saved templates isn't stuck facing an empty canvas — manual column entry is always available, not gated behind having a template first.
- The AI-draft box (promoted from the Tables dashboard) can populate the same canvas in one shot: describing the table in text fills in rows/columns as if the user had clicked the equivalent list/template.

**Drag-and-drop — deferred to v2, not the primary mechanic:**
- Click-to-add achieves the same "assemble it visually, see it live" feeling with far less engineering cost (no drop-zone states, no touch/mobile drag fallback, no keyboard-drag accessibility to solve before shipping v1).
- Reordering columns by drag (once already added) is a reasonable v2 enhancement — it's a smaller, self-contained interaction than drag-to-add and doesn't block v1.

Key changes vs. current `TableCreation.png`:
- The creation surface is the live grid itself, not a separate form+sidebar that only shows the table after saving.
- Base List selection is single-select and immediate (click → rows appear), not a form field.
- Column Templates apply as a whole set via one click, not a top-level browsing section.
- One "Create" action — no separate List-save step before Table-save step.

---

## Library Page (Manage Saved Lists + Templates)

One "Library" nav item, not two hidden pages, and not two separate destinations for lists vs. templates (resolves open questions 1 & 2 below). Structure: a **master-detail layout**, matching the same "click it, see it live, no page navigation" pattern already used in the create-table canvas — so the app has one consistent interaction model instead of a second one just for management screens.

```
┌─────────────────────────────────────────────────────────┐
│  Library                     [ Lists ]  [ Templates ]    │  ← tab/toggle
├───────────────┬───────────────────────────────────────────┤
│ Class A1      │  Class A1                                 │
│ Names         │  ──────────────────────────────────────── │
│ Test          │  First Name │ Last Name                   │
│               │  David      │ Cohen         [inline edit]  │
│ + New list    │  John       │ Snow                         │
│               │  ...                                       │
└───────────────┴───────────────────────────────────────────┘
```

- Left index lists either Base Lists or Templates depending on the active tab; clicking an item renders its detail (rows for a list, column schema for a template) directly in the right pane on the same page — no route change, no separate `BaseListView`/`TemplateView` page load.
- Both object types live on one page because they're the same *kind* of thing to the user: "reusable stuff I set up once." A tab flip is cheaper than teaching two nav destinations.
- This shell is deliberately generic (index + detail) so it can absorb the future Workbenches/Groups hierarchy as a nested tree in the left pane later, without restructuring the page.
- Existing `BaseListView.png` / `TemplateView.png` detail content is reused as the right-pane content — this is a layout change (inline vs. separate page), not a rebuild of those views.

### Detail pane — Templates tab

Content is `TemplateView.png`'s existing fields (columns count, used-by count, category, column schema table) resized into the right pane, plus inline-edit affordances that page didn't need as a standalone screen:

```
┌───────────────┬───────────────────────────────────────────────┐
│ Templates      │  🎓 Exam                            [Category: Education ▾] │
│                │  ─────────────────────────────────────────────│
│ Attendance list│  Columns: 4      Used by: 0 lists   [🔒Private]│
│ ▸ Exam         │                                                 │
│ + New template │  [+ Apply to lists…]           [Save as copy]  │
│                │  ─────────────────────────────────────────────│
│                │  Column Schema                    [+ Add column]│
│                │  ┌─────────────┬──────────┬──────────────────┐│
│                │  │ Label       │ Type     │                  ││
│                │  ├─────────────┼──────────┼──────────────────┤│
│                │  │ Q1          │ number ▾ │      [🗑]        ││
│                │  │ Q2          │ number ▾ │      [🗑]        ││
│                │  │ Q3          │ number ▾ │      [🗑]        ││
│                │  │ Q4          │ number ▾ │      [🗑]        ││
│                │  └─────────────┴──────────┴──────────────────┘│
│                │                                    [Delete template]│
└───────────────┴───────────────────────────────────────────────┘
```

- **Left index** (Templates tab): flat list of saved templates + "+ New template," same shell as the Lists tab. Selected item highlighted (`▸ Exam`).
- **Header row**: name, category (inline-editable dropdown, not a separate settings screen), private/public badge — matches `TemplateView.png`'s existing metadata fields.
- **Stats row**: columns count / used-by count kept as plain read-only text (they're derived, not editable) — no need to invent new UI for these.
- **Primary actions**: "Apply to lists…" (the existing apply-template action, surfaced here instead of only from the create-table canvas) and "Save as copy" (fork a template without mutating one already in use by other lists — avoids the auto-sync conflict problem noted in `02_column_templates.md`).
- **Column schema becomes an editable table inline** (label + type per row, delete row, "+ Add column") instead of the read-only list `TemplateView.png` currently shows — this is the one real upgrade over the old page, since "manage my templates" implies editing them, not just viewing metadata.
- **Delete template** stays a deliberate, secondary action at the bottom — not next to the header trash icon `TemplateView.png` used, to avoid accidental deletes now that this pane is reached by casual browsing/clicking through the index rather than a dedicated page visit.

---

## Screen-by-screen disposition

| Current screen | Disposition |
|---|---|
| `MainDashboard.png` | Simplify to redirect straight into Tables (or keep as a thin launcher with one primary "Tables" card + recent activity — not 3 equal cards) |
| `BaseListsDashboard.png` | Replaced by Library page's "Lists" tab (index pane) |
| `BaseListCreation.png` | Becomes an inline "New list" mini-form inside the create-table flow's Entities step, and the "+ New list" action in the Library page's Lists tab |
| `BaseListView.png` | Content reused as the Library page's right-pane detail (rendered inline, no separate page nav) |
| `TablesDashboard.png` | Becomes the app's home screen |
| `TableCreation.png` | Replaced by the live-canvas flow above (base lists left rail, templates top rail, grid in center) |
| `TableView.png` | Unchanged — this is the destination screen and already works |
| `TemplatesDashboard.png` | Replaced by Library page's "Templates" tab (index pane) |
| `TemplateCreation.png` | Kept as the "+ New template" / "Save as template" flow |
| `TemplateView.png` | Content reused as the Library page's right-pane detail (Templates tab) |
| `LandingPage.png` | Unchanged (pre-auth, not part of this IA) |

---

## Decisions (resolved)

1. **Nav structure:** Single "Library" nav item covering both Base Lists and Templates as tabs on one page (master-detail, see § Library Page above) — not two separate hidden pages, and not a first-class standalone "Base Lists" nav item. Total top-level nav: Tables + Library.
2. **Library page layout:** Approved — left index / right inline-detail on one page for both Lists and Templates tabs, per the design above. Final visual pass still pending, but the architecture (index + detail, no separate page nav) is confirmed and intentionally kept flexible/revertable.
3. **Auto-save-as-template prompt:** Deferred — manual "Save as template" button only for v1. Simpler to ship; revisit auto-prompting later.
4. **Table-to-Base-List relationship:** Confirmed strictly **1 table : 1 Base List**, no merging multiple lists into one table at this stage. Left rail in the create-table canvas is single-select (click swaps rows), matching the existing data model — no schema change needed.
5. **Interaction method:** Confirmed **click-only** for v1 (no drag-and-drop). Drag remains a possible future nice-to-have, not a near-term priority.

**Noted for later (not blocking this doc):** Base Lists are intentionally simple/flat now on purpose — they exist so users can save a roster once and reuse it, avoiding manual rebuilds. The planned Workbenches/Groups hierarchy (nested lists with permissions, e.g. School → Grade Level → Class) is future scope; the Library page's index/detail shell was chosen specifically because it can grow into a tree later without a redesign.

---

## Implementation Checklist

**IA / Navigation:**
- [ ] Collapse global nav to "Tables" + "Library"
- [ ] Make Tables dashboard the default post-login route
- [ ] Move AI-draft box from Tables dashboard into the create-table flow

**Library Page:**
- [ ] Build master-detail Library page with "Lists" / "Templates" tabs
- [ ] Left index pane per tab (reuses card data from `BaseListsDashboard`/`TemplatesDashboard`)
- [ ] Right detail pane renders inline on click, reusing `BaseListView`/`TemplateView` content (no route change)
- [ ] "+ New list" / "+ New template" actions in the respective index pane

**Create-Table Flow (Live Canvas):**
- [ ] Build live-canvas create-table page: left rail (Base Lists), top rail (Templates), center grid
- [ ] Click a Base List → populate grid rows immediately (single-select, confirmed 1:1 table-to-list relationship)
- [ ] Click a Template chip → inject its full column set into the grid at once
- [ ] Persistent "+ Add column" control in the grid header (always available, not gated on templates)
- [ ] Inline "New list" mini-form in the left rail (replaces standalone `BaseListCreation` step)
- [ ] AI-draft box populates the same canvas in one shot
- [ ] (possible future nice-to-have, not prioritized) Drag-and-drop for rows/templates/column reordering

**Demoted surfaces:**
- [ ] Base Lists dashboard/detail replaced by Library page's Lists tab
- [ ] Templates dashboard/detail replaced by Library page's Templates tab

**Verification:**
- [ ] Time/click-count a first-time user creating one table from login; target ≤2 pages, 0 mandatory forms before the AI-draft or manual column entry
- [ ] Confirm existing Base Lists / Templates data and detail pages still function unchanged for users who navigate to them via the new indirect paths

---

**Estimated Effort:** 1–1.5 weeks (mostly recomposition of existing components into one flow; TableView/BaseListView/TemplateView detail pages are reused as-is)
**Dependencies:** None blocking — can be built incrementally behind the existing pages before nav is switched over
