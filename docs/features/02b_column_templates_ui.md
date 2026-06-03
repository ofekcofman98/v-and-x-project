# VocalGrid — Column Templates UI/UX Specification

**Document:** `02b_column_templates_ui.md`  
**Version:** 1.0  
**Role:** Lead UI/UX Product Designer  
**Dependencies:** `docs/features/02_column_templates.md`, `14_PRODUCT_DATA_FLOW.md`  
**Design System:** Tailwind CSS, shadcn/ui primitives

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Paradigm A: The Creation Studio](#2-paradigm-a-the-creation-studio)
   - 2.1 [Layout Architecture](#21-layout-architecture)
   - 2.2 [Left Sidebar — BaseList Browser](#22-left-sidebar--baselist-browser)
   - 2.3 [Top Track — Template Carousel](#23-top-track--template-carousel)
   - 2.4 [Center Canvas — Drop Zone Workspace](#24-center-canvas--drop-zone-workspace)
   - 2.5 [Post-Drop Configuration Panel](#25-post-drop-configuration-panel)
   - 2.6 [Interaction States](#26-interaction-states)
   - 2.7 [Accessible Drag Fallback](#27-accessible-drag-fallback)
3. [Paradigm B: The Bulk Application Dashboard](#3-paradigm-b-the-bulk-application-dashboard)
   - 3.1 [Templates Grid View](#31-templates-grid-view)
   - 3.2 [Template Detail Modal](#32-template-detail-modal)
   - 3.3 [Bulk Target Selector](#33-bulk-target-selector)
   - 3.4 [BaseList Grouping System](#34-baselist-grouping-system)
   - 3.5 [Merge Strategy Controls](#35-merge-strategy-controls)
   - 3.6 [Conflict Detection & Resolution](#36-conflict-detection--resolution)
   - 3.7 [Execution & Feedback](#37-execution--feedback)
4. [Shared Component Inventory](#4-shared-component-inventory)
5. [Responsive Behavior](#5-responsive-behavior)
6. [Accessibility Checklist](#6-accessibility-checklist)

---

## 1. Design Philosophy

**Core Principle:** Templates should feel like LEGO bricks — snap-on schema modules the user can attach to any BaseList without friction.

**Design Goals:**

- **Zero-Confusion UX:** The user must instantly understand what a template is (a column structure) vs. what a BaseList is (the entity data) without reading documentation
- **Visual Clarity:** Use spatial layout to encode meaning — BaseLists live on the left (entities = rows = vertical), Templates live on top (columns = horizontal)
- **Progressive Disclosure:** Show simple actions first (drag & drop, single-click apply), reveal advanced options (merge strategy, auto-sync, grouping) only on demand
- **Speed:** Power users should be able to create a Table from BaseList + Template in under 5 seconds

**Design Language:**

| Element | Visual Treatment | Semantic Meaning |
|---------|-----------------|-------------------|
| BaseList | Vertical card with entity count badge | "These are my people/items" |
| Template | Horizontal card with column pills | "This is my data structure" |
| Drop Zone | Dashed border canvas | "Combine things here" |
| Locked Column | Blue pill with lock icon | "Inherited, don't touch" |
| User Column | White pill with edit affordance | "You defined this" |

---

## 2. Paradigm A: The Creation Studio

### 2.1 Layout Architecture

**Route:** `/tables/create` or `/studio`

**Full-Screen Layout (3-Zone Grid):**

```
┌──────────────────────────────────────────────────────────────────┐
│  AppHeader  [← Back to Tables]              [?] Help   [×] Close│
├────────────┬─────────────────────────────────────────────────────┤
│            │  TOP TRACK: Template Carousel                       │
│            │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  LEFT      │  │Educatn │ │  HR    │ │Inventory│ │ Custom │ ←→   │
│  SIDEBAR   │  │4 cols  │ │6 cols  │ │5 cols   │ │3 cols  │      │
│            │  └────────┘ └────────┘ └────────┘ └────────┘      │
│  BaseLists │─────────────────────────────────────────────────────│
│            │                                                     │
│ ┌────────┐ │           CENTER CANVAS                            │
│ │Class10A│ │                                                     │
│ │30 ents │ │     ┌─────────────────────────────────┐            │
│ ├────────┤ │     │                                 │            │
│ │Class10B│ │     │    Drop a BaseList + Template   │            │
│ │28 ents │ │     │    here to create a Table       │            │
│ ├────────┤ │     │                                 │            │
│ │Products│ │     │    🗂️ ← Drag from left          │            │
│ │150 ents│ │     │    📋 ← Drag from top           │            │
│ ├────────┤ │     │                                 │            │
│ │Employes│ │     └─────────────────────────────────┘            │
│ │45 ents │ │                                                     │
│ └────────┘ │                                                     │
│            │                                                     │
│ [+ New]    │                              [Skip → Create Empty] │
├────────────┴─────────────────────────────────────────────────────┤
│  Footer: "Drag a list and a template to the canvas to begin"    │
└──────────────────────────────────────────────────────────────────┘
```

**Tailwind Layout Blueprint:**

```
Page Container:    fixed inset-0 bg-background z-50 flex flex-col
AppHeader:         h-14 border-b px-6 flex items-center justify-between
Body:              flex-1 flex overflow-hidden
Left Sidebar:      w-72 border-r flex flex-col bg-muted/30
Top Track:         h-36 border-b flex items-center px-6 overflow-x-auto gap-4
Center Canvas:     flex-1 flex items-center justify-center p-8
```

---

### 2.2 Left Sidebar — BaseList Browser

**Purpose:** Browse and drag existing BaseLists into the canvas.

**Layout:**

```
┌─────────────────────┐
│ 📋 Base Lists        │  ← Section header
│ ┌─────────────────┐ │
│ │ 🔍 Search...     │ │  ← Search input
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ 🗂️ Class 10A     │ │  ← Draggable BaseList card
│ │ 30 entities      │ │     Grab handle on left edge
│ │ 3 columns        │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 🗂️ Class 10B     │ │
│ │ 28 entities      │ │
│ │ 3 columns        │ │
│ └─────────────────┘ │
│                     │
│ ─── Empty State ─── │
│ "No lists found"    │
│ [Create Base List]  │
│                     │
│ ─── Footer ─────── │
│ [+ New Base List]   │
└─────────────────────┘
```

**BaseList Card Spec:**

| Property | Detail |
|----------|--------|
| Container | `p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing` |
| Drag Handle | Left edge, 4px wide, `bg-muted-foreground/20 rounded-l-lg` |
| Title | `text-sm font-medium truncate` — BaseList name |
| Meta Line 1 | `text-xs text-muted-foreground` — "{N} entities" |
| Meta Line 2 | `text-xs text-muted-foreground` — "{N} columns" |
| Hover State | `ring-2 ring-blue-500/50 shadow-md` |
| Dragging State | `opacity-50 ring-2 ring-blue-500` + ghost clone follows cursor |
| Drag Data | `{ type: 'base_list', id: string, name: string }` |

**Search Behavior:**
- Filter BaseLists by name (client-side, debounced 200ms)
- Show "No results" empty state with clear button
- Preserve scroll position across searches

---

### 2.3 Top Track — Template Carousel

**Purpose:** Browse and drag Column Templates into the canvas.

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│ 📐 Column Templates                    [Browse All →]        │
│                                                              │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│ │ 🎓       │  │ 👔       │  │ 📦       │  │ ⚙️       │     │
│ │Education │  │ HR       │  │Inventory │  │ Custom   │ ←→  │
│ │          │  │          │  │          │  │          │     │
│ │Name      │  │Full Name │  │Product   │  │Title     │     │
│ │ID        │  │Dept      │  │SKU       │  │Status    │     │
│ │Email     │  │Role      │  │Price     │  │Notes     │     │
│ │Grade     │  │Start Date│  │Qty       │  │          │     │
│ │          │  │Salary    │  │Category  │  │          │     │
│ │          │  │Badge No  │  │          │  │          │     │
│ │ 4 cols   │  │ 6 cols   │  │ 5 cols   │  │ 3 cols   │     │
│ └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Template Card Spec:**

| Property | Detail |
|----------|--------|
| Container | `w-48 min-w-[192px] h-full p-4 rounded-xl border bg-card cursor-grab flex flex-col` |
| Category Icon | `text-2xl mb-2` — emoji or Lucide icon top-left |
| Title | `text-sm font-semibold` — Template name |
| Column Pills | `flex flex-col gap-1 flex-1 overflow-hidden` — max 5 visible |
| Each Pill | `text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 truncate` |
| Footer | `text-xs text-muted-foreground mt-2` — "{N} columns" |
| Hover | `ring-2 ring-purple-500/50 shadow-lg scale-[1.02] transition-transform` |
| Dragging | `opacity-50 ring-2 ring-purple-500` |
| Drag Data | `{ type: 'column_template', id: string, name: string }` |

**Scroll Behavior:**
- Horizontal scroll with mouse wheel (shift+scroll or trackpad)
- Scroll snap: `scroll-snap-type: x mandatory` on container, `scroll-snap-align: start` on cards
- Left/right fade gradient at edges to indicate scrollability
- Keyboard: Arrow keys navigate between cards when track is focused

**Category Mapping:**

| Category | Icon | Color Accent |
|----------|------|-------------|
| Education | 🎓 | `bg-blue-50 text-blue-700` |
| HR | 👔 | `bg-purple-50 text-purple-700` |
| Inventory | 📦 | `bg-amber-50 text-amber-700` |
| Finance | 💰 | `bg-green-50 text-green-700` |
| Healthcare | 🏥 | `bg-red-50 text-red-700` |
| Custom | ⚙️ | `bg-gray-50 text-gray-700` |

---

### 2.4 Center Canvas — Drop Zone Workspace

**Purpose:** The visual combination workspace where BaseList + Template = Table.

**States:**

**State 1: Empty (Default)**

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
╎                                                 ╎
╎            🗂️  +  📐  =  📊                     ╎
╎                                                 ╎
╎    Drag a Base List and a Column Template       ╎
╎    onto this canvas to create a new Table       ╎
╎                                                 ╎
╎    ─── or ───                                   ╎
╎                                                 ╎
╎    [Skip → Create Empty Table]                  ╎
╎                                                 ╎
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

| Property | Tailwind |
|----------|----------|
| Container | `border-2 border-dashed border-muted-foreground/30 rounded-2xl` |
| Size | `w-full max-w-2xl aspect-video` |
| Text | `text-center text-muted-foreground text-sm` |
| Icon Row | `text-4xl flex items-center justify-center gap-4 mb-6` |

**State 2: BaseList Dropped (Waiting for Template)**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ✅ Class 10A loaded (30 entities, 3 columns)   │
│  ┌─────────────────────────────────────────┐    │
│  │ Name         │ Student ID │ Email       │    │
│  │ Alice Johnson│ 001        │ alice@...   │    │
│  │ Bob Smith    │ 002        │ bob@...     │    │
│  │ Charlie Brown│ 003        │ charlie@... │    │
│  │ ... 27 more rows                       │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  ╎  Now drag a Template here to add columns ╎  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                                 │
│  [✕ Remove BaseList]                            │
└─────────────────────────────────────────────────┘
```

| Property | Tailwind |
|----------|----------|
| Container | `border-2 border-solid border-blue-500 rounded-2xl bg-blue-50/30` |
| Mini Preview | `max-h-48 overflow-hidden rounded-lg border bg-card` — first 3 rows |
| Template Zone | `border-2 border-dashed border-purple-400/50 rounded-lg p-4 mt-4` |

**State 3: Template Dropped (Waiting for BaseList)**

Same logic as State 2 but inverted — shows template column preview, dashed zone awaits BaseList.

**State 4: Both Dropped — Preview & Configure**

The canvas transforms into the Post-Drop Configuration Panel (see 2.5).

---

### 2.5 Post-Drop Configuration Panel

**Trigger:** Both a BaseList and a Template have been dropped on the canvas.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ Ready to Create Table                                    │
│                                                             │
│  ┌─── Meta ──────────────────────────────────────────────┐  │
│  │ Table Name: [Math Exam Q1______________]              │  │
│  │ Description: [First quarter math exam__]              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Column Preview ───────────────────────────────────┐  │
│  │                                                       │  │
│  │  FROM BASE LIST (locked)     FROM TEMPLATE (locked)   │  │
│  │  ┌──────────┐               ┌──────────┐             │  │
│  │  │🔒 Name   │               │🔒 Score  │             │  │
│  │  │  text    │               │  number  │             │  │
│  │  ├──────────┤               ├──────────┤             │  │
│  │  │🔒 ID     │               │🔒 Grade  │             │  │
│  │  │  text    │               │  text    │             │  │
│  │  ├──────────┤               ├──────────┤             │  │
│  │  │🔒 Email  │               │🔒 Notes  │             │  │
│  │  │  text    │               │  text    │             │  │
│  │  └──────────┘               └──────────┘             │  │
│  │                                                       │  │
│  │  [+ Add Custom Column]                                │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Voice Matching ───────────────────────────────────┐  │
│  │ Representative Column for Voice Input:                │  │
│  │                                                       │  │
│  │ (●) Name        → "Alice, 92"                        │  │
│  │ ( ) Student ID  → "001, 92"                          │  │
│  │ ( ) Email       → "alice@school.edu, 92"             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Settings ─────────────────────────────────────────┐  │
│  │ Auto-Sync Template Changes: [━━━○─────]  Off         │  │
│  │                                                       │  │
│  │ ℹ️ When ON, schema changes to the template will      │  │
│  │   automatically update this table's columns.          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [← Start Over]                         [Create Table →]   │
└─────────────────────────────────────────────────────────────┘
```

**Section Breakdown:**

**Meta Section:**
- Table Name: `Input` — auto-populated as `"{BaseListName} — {TemplateName}"`, user can edit
- Description: `Textarea` — optional, 2 rows max

**Column Preview Section:**

| Zone | Visual | Behavior |
|------|--------|----------|
| BaseList Columns | Blue pill with 🔒 icon, `bg-blue-50 border-blue-200` | Read-only, show column name + type |
| Template Columns | Purple pill with 🔒 icon, `bg-purple-50 border-purple-200` | Read-only, show column name + type |
| Custom Columns | White pill with edit icon, `bg-white border-gray-200` | Editable name + type dropdown |
| Add Custom | `Button variant="outline"` with `+` icon | Appends editable column row |

**Representative Column Selector:**
- Radio group showing all text-type columns from both BaseList and Template
- Each option shows example voice input format
- Only text columns eligible — number/date/boolean options disabled with tooltip

**Auto-Sync Toggle:**
- `Switch` component (shadcn/ui)
- Default: OFF
- Info tooltip explaining sync behavior
- When ON, show yellow info banner: "Template updates will modify this table's columns automatically"

**Action Buttons:**

| Button | Variant | Behavior |
|--------|---------|----------|
| "← Start Over" | `outline` | Clears canvas, returns to empty state |
| "Create Table →" | `default` (primary) | Validates and submits to `POST /api/tables` |

---

### 2.6 Interaction States

**Drag-Over States:**

| Target Zone | When Dragging BaseList | When Dragging Template |
|-------------|----------------------|----------------------|
| Canvas (empty) | `border-blue-500 bg-blue-50/20 scale-[1.01]` | `border-purple-500 bg-purple-50/20 scale-[1.01]` |
| Canvas (has template) | `border-blue-500 bg-blue-50/20` | N/A (already has template) |
| Canvas (has baselist) | N/A (already has baselist) | `border-purple-500 bg-purple-50/20` |
| Invalid zone | `border-red-300 bg-red-50/10` | `border-red-300 bg-red-50/10` |

**Drag Ghost:**
- Semi-transparent clone of the source card
- `opacity-70 shadow-2xl rotate-2 scale-95`
- Shows item name as floating label

**Drop Animation:**
- On valid drop: Card slides into canvas position with `transition-all duration-300 ease-out`
- On invalid drop: Card snaps back to origin with `transition-all duration-200 ease-in`

**Error States:**

| Error | Trigger | Display |
|-------|---------|---------|
| Duplicate Drop | Dropping BaseList when one already exists | Toast: "A BaseList is already loaded. Remove it first." |
| Wrong Type | Dropping Template on BaseList zone (or vice versa) | Canvas flashes red briefly, no action |
| Self-Drop | Dropping item back to its source list | No-op, no visual feedback |

---

### 2.7 Accessible Drag Fallback

For keyboard-only and screen reader users, provide a non-drag alternative:

**Keyboard Flow:**

1. Tab to sidebar → Arrow keys to navigate BaseLists
2. Press `Enter` or `Space` on a BaseList → "Selected: Class 10A. Press Enter again to load into canvas."
3. Press `Enter` → BaseList loaded into canvas
4. Tab to top track → Arrow keys to navigate Templates
5. Press `Enter` on a Template → Template loaded into canvas
6. Tab to configuration panel → Fill form → Submit

**Screen Reader Announcements:**

| Action | Announcement |
|--------|-------------|
| Focus BaseList card | "Class 10A, 30 entities, 3 columns. Press Enter to load into canvas." |
| Load BaseList | "Class 10A loaded into canvas. Navigate to template carousel to select a template." |
| Focus Template card | "Education Template, 4 columns: Name, Student ID, Email, Grade. Press Enter to apply." |
| Both loaded | "BaseList and Template loaded. Navigate to configuration form to finalize your table." |
| Table created | "Table 'Math Exam Q1' created successfully with 30 entities and 7 columns." |

**ARIA Attributes:**

```
Canvas:       role="application" aria-label="Table creation workspace"
              aria-describedby="canvas-instructions"
BaseList card: role="option" aria-grabbed="false" tabindex="0"
Template card: role="option" aria-grabbed="false" tabindex="0"
Sidebar:       role="listbox" aria-label="Available Base Lists"
Top Track:     role="listbox" aria-label="Available Column Templates"
```

---

## 3. Paradigm B: The Bulk Application Dashboard

### 3.1 Templates Grid View

**Route:** `/templates` or `/settings/templates`

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  AppHeader                                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Column Templates                    [+ Create Template]     │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Category │ │ All      │ │ My       │ │ Public   │       │
│  │ Filter ▼ │ │ ●        │ │ ○        │ │ ○        │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ 🎓 Education   │  │ 👔 HR Basics   │  │ 📦 Inventory  │ │
│  │                │  │                │  │                │ │
│  │ Name           │  │ Full Name      │  │ Product Name   │ │
│  │ Student ID     │  │ Department     │  │ SKU            │ │
│  │ Email          │  │ Role           │  │ Price          │ │
│  │ Grade Level    │  │ Start Date     │  │ Quantity       │ │
│  │                │  │ Salary         │  │ Category       │ │
│  │ 4 columns      │  │ Badge Number   │  │                │ │
│  │ Used by 5 lists│  │                │  │ 5 columns      │ │
│  │                │  │ 6 columns      │  │ Used by 2 lists│ │
│  │ [Apply] [Edit] │  │ Used by 3 lists│  │                │ │
│  └────────────────┘  │                │  │ [Apply] [Edit] │ │
│                      │ [Apply] [Edit] │  └────────────────┘ │
│                      └────────────────┘                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Grid Spec:**

| Property | Tailwind |
|----------|----------|
| Container | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6` |
| Card | `rounded-xl border bg-card p-5 hover:shadow-lg transition-shadow` |
| Category Icon | `text-3xl mb-3` |
| Title | `text-base font-semibold mb-3` |
| Column List | `space-y-1 mb-4` — max 6 visible, then "+N more" |
| Column Pill | `text-xs text-muted-foreground flex items-center gap-1.5` with dot indicator |
| Footer | `flex items-center justify-between pt-3 border-t` |
| Usage Badge | `text-xs text-muted-foreground` — "Used by N lists" |
| Apply Button | `Button size="sm"` — opens detail modal |
| Edit Button | `Button size="sm" variant="ghost"` — opens edit form |

**Filter Bar:**

| Filter | Component | Behavior |
|--------|-----------|----------|
| Category | `Select` dropdown | Filter by: All, Education, HR, Inventory, etc. |
| Scope | `RadioGroup` inline | All / My Templates / Public Templates |
| Search | `Input` with search icon | Client-side filter by template name |
| Sort | `Select` dropdown | Newest, Most Used, Name A→Z |

---

### 3.2 Template Detail Modal

**Trigger:** Click "Apply" on any template card.

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌── Dialog ────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │  Apply "Education Template"                   [×]    │    │
│  │  ─────────────────────────────────────────────────   │    │
│  │                                                      │    │
│  │  ┌── Column Preview ────────────────────────────┐   │    │
│  │  │                                              │   │    │
│  │  │  📝 Name ─────────── text (required)         │   │    │
│  │  │  📝 Student ID ───── text                    │   │    │
│  │  │  📝 Email ─────────── text                   │   │    │
│  │  │  🔢 Grade Level ──── number                  │   │    │
│  │  │                                              │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  │                                                      │    │
│  │  ┌── Target BaseLists ──────────────────────────┐   │    │
│  │  │                                              │   │    │
│  │  │  Select which Base Lists to apply to:        │   │    │
│  │  │                                              │   │    │
│  │  │  ┌─ Groups ──────────────────────────────┐  │   │    │
│  │  │  │ ☐ Grade 1 (3 lists)                   │  │   │    │
│  │  │  │ ☐ Grade 2 (2 lists)                   │  │   │    │
│  │  │  └───────────────────────────────────────┘  │   │    │
│  │  │                                              │   │    │
│  │  │  ┌─ Individual ──────────────────────────┐  │   │    │
│  │  │  │ ☑ Class 10A          30 entities      │  │   │    │
│  │  │  │ ☑ Class 10B          28 entities      │  │   │    │
│  │  │  │ ☐ Class 10C          25 entities      │  │   │    │
│  │  │  │ ☐ Products           150 entities     │  │   │    │
│  │  │  │ ☐ Employees          45 entities      │  │   │    │
│  │  │  └───────────────────────────────────────┘  │   │    │
│  │  │                                              │   │    │
│  │  │  Selected: 2 lists (58 total entities)       │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  │                                                      │    │
│  │  ┌── Merge Strategy ───────────────────────────┐   │    │
│  │  │                                              │   │    │
│  │  │  (●) Append — Add template columns to        │   │    │
│  │  │      existing columns (non-destructive)      │   │    │
│  │  │                                              │   │    │
│  │  │  ( ) Replace — Replace all non-default       │   │    │
│  │  │      columns with template columns           │   │    │
│  │  │                                              │   │    │
│  │  │  ⚠️ 1 conflict detected: "Name" column      │   │    │
│  │  │     exists in Class 10A (will be skipped)    │   │    │
│  │  │                                              │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  │                                                      │    │
│  │  ┌── Settings ─────────────────────────────────┐   │    │
│  │  │ Auto-Sync: [━━━○─────]  Off                  │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  │                                                      │    │
│  │  [Cancel]                    [Apply to 2 Lists →]   │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Modal Spec:**

| Property | Tailwind |
|----------|----------|
| Dialog | `DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"` |
| Section Dividers | `border rounded-lg p-4 mb-4 bg-muted/30` |
| Column Preview | `space-y-2` — each row: icon + name + type badge |
| Type Badge | `text-xs px-2 py-0.5 rounded-full bg-muted` |
| Action Button | `Button` — dynamic label: "Apply to {N} Lists →" |

---

### 3.3 Bulk Target Selector

**Purpose:** Multi-select interface for choosing which BaseLists receive the template.

**Component: CheckboxList with Search**

```
┌─────────────────────────────────────────────┐
│ 🔍 Search base lists...                      │
├─────────────────────────────────────────────┤
│                                             │
│  ☐ Select All (5 lists)                     │  ← Master toggle
│  ─────────────────────────────              │
│  ☑ Class 10A        30 entities   ⚠️ 1     │  ← Conflict badge
│  ☑ Class 10B        28 entities             │
│  ☐ Class 10C        25 entities             │
│  ☐ Products         150 entities            │
│  ☐ Employees        45 entities   ⚠️ 2     │  ← Conflict badge
│                                             │
├─────────────────────────────────────────────┤
│  Selected: 2 lists (58 total entities)      │  ← Live counter
└─────────────────────────────────────────────┘
```

**Behaviors:**

| Interaction | Behavior |
|-------------|----------|
| Click checkbox | Toggle single BaseList selection |
| Click "Select All" | Toggle all visible (filtered) BaseLists |
| Search | Filter list client-side, preserve selections |
| Conflict badge (⚠️) | Hover shows tooltip with conflicting column names |
| Entity counter | Updates in real-time as selections change |

---

### 3.4 BaseList Grouping System

**Purpose:** Allow organizational grouping of BaseLists for efficient bulk operations.

**Group Definition:**

Groups are defined at the organization level and stored in organization settings.

```
Example Groups:
├── Grade 1
│   ├── Class 10A
│   ├── Class 10B
│   └── Class 10C
├── Grade 2
│   ├── Class 11A
│   └── Class 11B
└── Staff
    ├── Teachers
    └── Admin Staff
```

**UI Presentation in Target Selector:**

```
┌─────────────────────────────────────────────┐
│ 🔍 Search...                                 │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ Groups ────────────────────────────┐   │
│  │ ☐ Grade 1 (3 lists, 83 entities)    │   │  ← Expands on click
│  │   ☐ Class 10A     30 entities       │   │
│  │   ☐ Class 10B     28 entities       │   │
│  │   ☐ Class 10C     25 entities       │   │
│  │                                     │   │
│  │ ☐ Grade 2 (2 lists, 55 entities)    │   │  ← Collapsed
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─ Ungrouped ─────────────────────────┐   │
│  │ ☐ Products        150 entities      │   │
│  │ ☐ Employees       45 entities       │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│  Selected: 0 lists                          │
└─────────────────────────────────────────────┘
```

**Group Checkbox Behavior:**

| State | Visual | Meaning |
|-------|--------|---------|
| Unchecked | `☐` | No children selected |
| Checked | `☑` | All children selected |
| Indeterminate | `☐` with dash | Some children selected |

**Expand/Collapse:**
- Groups collapsed by default
- Click group name or chevron to expand/collapse
- Click group checkbox to select/deselect all children without expanding
- Smooth height animation: `transition-[max-height] duration-200 ease-out overflow-hidden`

---

### 3.5 Merge Strategy Controls

**Purpose:** Let user choose how template columns interact with existing BaseList columns.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ Merge Strategy                                       │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ (●) Append Columns                              │ │
│ │     Add template columns alongside existing     │ │
│ │     ones. Existing columns remain untouched.    │ │
│ │                                                 │ │
│ │     Before: [Name] [Email]                      │ │
│ │     After:  [Name] [Email] [+Score] [+Grade]    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ( ) Replace Columns                             │ │
│ │     Remove all non-default columns and apply    │ │
│ │     template columns. "Name" column preserved.  │ │
│ │                                                 │ │
│ │     Before: [Name] [Email] [Phone]              │ │
│ │     After:  [Name] [Score] [Grade]              │ │
│ │                                                 │ │
│ │     ⚠️ This will remove existing column data    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Spec:**

| Property | Tailwind |
|----------|----------|
| Container | `space-y-3` |
| Option Card | `p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors` |
| Selected Card | `border-primary bg-primary/5 ring-1 ring-primary` |
| Title | `text-sm font-medium` |
| Description | `text-xs text-muted-foreground mt-1` |
| Before/After Visual | `text-xs font-mono bg-muted rounded px-2 py-1 mt-2` |
| Replace Warning | `text-xs text-amber-600 flex items-center gap-1 mt-2` — ⚠️ icon |

**Replace Confirmation:**
When "Replace" is selected and user clicks "Apply," show a confirmation dialog:

```
"This will remove X existing columns and their data from Y base lists.
This action cannot be undone. Are you sure?"

[Cancel]  [Confirm Replace]
```

---

### 3.6 Conflict Detection & Resolution

**When Conflicts Occur:**
A conflict happens when a template column ID matches an existing column ID in a target BaseList.

**Detection Trigger:**
Conflicts are detected immediately when the user selects a BaseList in the target selector.

**Conflict Display:**

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Conflicts Detected                               │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Class 10A:                                      │ │
│ │  • "name" — exists in both (will be skipped)    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Employees:                                      │ │
│ │  • "name" — exists in both (will be skipped)    │ │
│ │  • "email" — exists in both (will be skipped)   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Conflicting columns will be skipped (Append mode)   │
│ or overwritten (Replace mode).                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Spec:**

| Property | Tailwind |
|----------|----------|
| Container | `border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm` |
| Header | `font-medium text-amber-800 flex items-center gap-2 mb-3` |
| List Section | `bg-white/50 rounded p-3 mb-2` |
| BaseList Name | `font-medium text-amber-900 text-xs mb-1` |
| Conflict Item | `text-xs text-amber-700 flex items-center gap-1` with bullet |
| Resolution Note | `text-xs text-amber-600 mt-3 italic` |

**Resolution Behavior by Strategy:**

| Strategy | Conflict Resolution |
|----------|-------------------|
| Append | Duplicate columns skipped, existing data preserved |
| Replace | Duplicate columns overwritten with template definition |

---

### 3.7 Execution & Feedback

**Apply Button States:**

| State | Label | Visual |
|-------|-------|--------|
| No selection | "Select Base Lists to Apply" | `Button disabled` |
| Ready | "Apply to {N} Lists →" | `Button default` |
| Processing | "Applying..." | `Button disabled` + spinner icon |
| Complete | "✓ Applied Successfully" | `Button` green variant, 2s then close |

**Progress Feedback (for bulk operations with 3+ lists):**

```
┌─────────────────────────────────────────────┐
│ Applying "Education Template"...             │
│                                             │
│ ████████████████░░░░░░░░░░░  3/5 lists     │
│                                             │
│ ✓ Class 10A — 4 columns added              │
│ ✓ Class 10B — 4 columns added              │
│ ✓ Class 10C — 3 columns added (1 skipped)  │
│ ◉ Products — Processing...                 │
│ ○ Employees — Pending                      │
│                                             │
└─────────────────────────────────────────────┘
```

**Post-Apply Toast:**

```
✅ Template "Education" applied to 5 base lists
   21 columns added, 3 conflicts skipped
   [View Results]  [Undo] (30 second window)
```

---

## 4. Shared Component Inventory

**Components Used From shadcn/ui:**

| Component | Used In | Purpose |
|-----------|---------|---------|
| `Dialog` | Template Detail Modal | Overlay container |
| `DialogContent` | Modal body | Max-w-2xl, scrollable |
| `Button` | All views | Primary/secondary actions |
| `Input` | Search, table name | Text input fields |
| `Textarea` | Description | Multi-line input |
| `Select` | Category filter, column type | Dropdown selectors |
| `Checkbox` | Target selector | Multi-select BaseLists |
| `RadioGroup` | Merge strategy, rep column | Single-select options |
| `Switch` | Auto-sync toggle | Boolean toggle |
| `ScrollArea` | Sidebar, modal body | Scrollable containers |
| `Card` | Template cards, BaseList cards | Container primitives |
| `Badge` | Usage count, conflict count | Small status indicators |
| `Tooltip` | Conflict details, locked items | Hover information |
| `Toast` | Success/error feedback | Notification messages |

**Custom Components to Build:**

| Component | File | Purpose |
|-----------|------|---------|
| `DraggableCard` | `components/shared/DraggableCard.tsx` | Card wrapper with drag behavior |
| `DropZone` | `components/shared/DropZone.tsx` | Canvas drop target with state management |
| `ColumnPillList` | `components/shared/ColumnPillList.tsx` | Truncated column name list |
| `ConflictBanner` | `components/templates/ConflictBanner.tsx` | Yellow warning with conflict details |
| `GroupedCheckboxList` | `components/shared/GroupedCheckboxList.tsx` | Expandable grouped multi-select |
| `MergeStrategyPicker` | `components/templates/MergeStrategyPicker.tsx` | Visual append/replace selector |
| `BulkProgressTracker` | `components/templates/BulkProgressTracker.tsx` | Progress bar with per-list status |

---

## 5. Responsive Behavior

| Viewport | Studio Layout | Dashboard Layout |
|----------|--------------|-----------------|
| Desktop (≥1280px) | Full 3-zone layout (sidebar + track + canvas) | 4-column template grid |
| Tablet (768–1279px) | Sidebar collapses to slide-over panel, track shrinks to 2 cards visible | 2-column grid |
| Mobile (<768px) | Studio unavailable — redirect to simplified "select & apply" flow | 1-column grid, full-screen modal |

**Mobile Fallback for Studio:**

Instead of drag-and-drop, mobile users see:

1. Step 1: Select BaseList (full-screen list)
2. Step 2: Select Template (full-screen carousel)
3. Step 3: Configure & Create (form)

This uses the same data flow but replaces spatial interaction with sequential steps.

---

## 6. Accessibility Checklist

**Drag & Drop:**
- [ ] All draggable items have `role="option"` and `tabindex="0"`
- [ ] Keyboard alternative: Enter/Space to select, Enter again to place in canvas
- [ ] Screen reader announces drag start, drop target, and drop result
- [ ] Focus returns to source after successful drop
- [ ] `aria-grabbed` and `aria-dropeffect` attributes set correctly

**Modal & Dialog:**
- [ ] Focus trapped inside modal when open
- [ ] Escape key closes modal
- [ ] Focus returns to trigger button on close
- [ ] All form fields have associated labels
- [ ] Error messages linked via `aria-describedby`

**Selection Lists:**
- [ ] Checkbox groups have `role="group"` with `aria-labelledby`
- [ ] Group expand/collapse uses `aria-expanded`
- [ ] Indeterminate checkbox state announced to screen readers
- [ ] Selected count announced via `aria-live="polite"` region

**Visual Indicators:**
- [ ] Color is never the sole indicator of state (always paired with icon or text)
- [ ] Conflict warnings use ⚠️ icon AND text AND color
- [ ] Locked columns use 🔒 icon AND "locked" text AND muted styling
- [ ] Focus outlines visible: `ring-2 ring-ring ring-offset-2`

**Keyboard Navigation:**

| Key | Context | Action |
|-----|---------|--------|
| `Tab` | Global | Move between zones (sidebar → track → canvas) |
| `Arrow Up/Down` | Sidebar list | Navigate BaseLists |
| `Arrow Left/Right` | Template track | Navigate Templates |
| `Enter` / `Space` | Card focused | Select/load into canvas |
| `Escape` | Canvas with items | Clear canvas |
| `Escape` | Modal open | Close modal |

---

**End of Specification**