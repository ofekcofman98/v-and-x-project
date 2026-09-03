# Interactive Grid — Selection, Delete-to-Clear & Resize — Spec

**Feature:** 20 — Interactive Grid (Excel/Word-like)
**Priority:** Medium
**Dependencies:** `docs/08_UI_COMPONENTS.md`, `docs/06_SMART_POINTER.md`, `docs/features/11_perf_and_navigation.md`, `docs/04_STATE_MANAGEMENT.md`, `docs/logs/PHASE_3_INTERACTIVE_GRID.md`
**Status:** Not Started
**Last Updated:** 2026-09-02

---

## Table of Contents

1. [Problem](#1-problem)
2. [Goal](#2-goal)
3. [Constraints From The Existing System](#3-constraints-from-the-existing-system)
4. [Already Available (Reuse, Do Not Rebuild)](#4-already-available-reuse-do-not-rebuild)
5. [New Scope 1: Multi-Cell Selection](#5-new-scope-1-multi-cell-selection)
6. [New Scope 2: Delete-to-Clear](#6-new-scope-2-delete-to-clear)
7. [New Scope 3: Column/Row Resize](#7-new-scope-3-columnrow-resize)
8. [Data Contract](#8-data-contract)
9. [Out of Scope](#9-out-of-scope)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [Implementation Order](#11-implementation-order)
12. [Notes for Reviewers](#12-notes-for-reviewers)

---

## 1. Problem

`DataTable.tsx` behaves like a read/write list of independently-addressable cells: a single `activeCell` pointer moves via click or keyboard, and clearing a value means entering edit mode and manually erasing the text. Users coming from Excel, Google Sheets, or Word tables expect three standard grid interactions that don't exist today: dragging to select a range of cells, pressing **Delete**/**Backspace** to instantly clear the selected cell(s), and dragging a column/row edge to resize it. `docs/logs/PHASE_3_INTERACTIVE_GRID.md` already flagged column width resizing as an unchecked future item; this spec formalizes it alongside the other two.

## 2. Goal

Add three grid-standard interactions to the shared table without disturbing the existing single-`activeCell` navigation/voice-pointer model:

1. **Selection** — select a contiguous rectangular range of cells via mouse drag, Shift+Click, or Shift+Arrow, visually distinct from the active-cell/nav-band highlighting.
2. **Delete-to-clear** — pressing Delete or Backspace while a selection exists (or just the active cell) clears every selected cell's value in one atomic write, no edit-mode entry required.
3. **Resize** — drag a column's right edge or a row's bottom edge to change its width/height; the new size persists across reloads.

---

## 3. Constraints From The Existing System

1. **`activeCell` is a single pointer, not a range, and must stay that way.** `ui-store.ts` and the voice pipeline (`usePointerKeyboardNav`, batch handlers, provisional targeting) all reason about exactly one active cell — this is load-bearing for voice entry (docs/06_SMART_POINTER.md) and must not be repurposed to mean "the whole selection." **Decision: selection is new, additive state (`selectionRange`) that always contains `activeCell`; `activeCell` keeps its current single-cell meaning everywhere else in the codebase.**

2. **Keyboard nav is a single global `keydown` listener with strict guards.** `usePointerKeyboardNav` already gates on `enabled`, `recordingState !== 'idle'`, and `isTypingTarget(event.target)` (an `<input>`/`<textarea>` is focused, i.e. a cell is mid-edit). Delete/Backspace handling and Shift+Arrow range-extension must respect the same guards — a Delete keystroke while a cell is being typed into must edit the text field, not clear the cell, and must never fire while a voice recording is in progress.

3. **Read-only and base-list (locked) cells must stay unwritable.** `DataTableCell`/`DataTable` already exclude `isBaseColumn`/`isReadOnly` cells from click-to-activate and edit affordances. Selection may visually include such cells (for read/copy purposes later), but Delete-to-clear and resize-affecting writes must skip them exactly like the existing edit path does — never silently swallow the write, and never throw for a mixed selection that includes some editable and some locked cells.

4. **Per-cell render isolation is a stated perf requirement.** `docs/features/11_perf_and_navigation.md` and `DataTableCell`'s own header comment establish that cells subscribe individually (via `useShallow` selectors) to avoid `DataTable`'s `rows.map()` re-rendering wholesale on pointer movement. A new `isSelected` boolean must be sourced the same way — a per-cell store subscription, not a prop threaded down from `DataTable`'s selection state — or dragging a selection across many cells will reintroduce the exact re-render cost that pattern was built to avoid.

5. **No resize state or drag-handle UI exists anywhere in the codebase today.** Column width is a hardcoded `min-w-[180px]` Tailwind class in `ColumnHeaderCell.tsx`; row height is a hardcoded `h-9` class in `DataTableCell.tsx`. There is no per-column/per-row size state, no drag-handle element, and no resize library imported in `package.json`. This is genuinely new surface, not a refactor of existing logic.

---

## 4. Already Available (Reuse, Do Not Rebuild)

- `activeCell: CellPosition | null` (`ui-store.ts`) — the anchor/focus for a new selection range extends this, does not replace it.
- `useTableCellStore.updateCellsBatch(tableId, writes, requestId?)` — atomic multi-cell write already exists (single `PATCH /api/tables/${tableId}/cells/batch`); Delete-to-clear should call this with each selected, writable cell's value set to `null`, not loop individual `updateCell` calls.
- `cellKey(rowKey, tableColumnId)` (exported from `table-cell-store.ts`) — reuse this exact key shape for any `Set<string>` of selected cells, so selection keys are directly comparable to cell-store keys.
- `useShallow` selector pattern (already used in `RowIndexCell` for nav-band and in `ColumnHeaderCell` for header highlighting) — reuse for the new per-cell `isSelected` read and for per-column/per-row size reads.
- `ui-store.ts`'s `persist` + `partialize` middleware pattern (`vocalgrid-ui-preferences` in localStorage) — model for where column widths / row heights should be persisted.
- `isTypingTarget` guard (`use-pointer-keyboard-nav.ts`) — reuse unchanged to keep Delete/Backspace from firing while a cell is in text-edit mode.
- `getNavBandAxis` / nav-band styling convention (`lib/client/navigation/nav-band.ts`) — model for how a second, visually distinct highlight layer (selection) can coexist with the existing active-cell/band layer without one overriding the other.
- `resetUI()` / `setActiveTable()` in `ui-store.ts` — the existing pattern of explicitly enumerating transient pointer state to clear on table switch; selection state must be added to both.

---

## 5. New Scope 1: Multi-Cell Selection

- **`ui-store.ts`** — add `selectionRange: { anchor: CellPosition; focus: CellPosition } | null`. `anchor` is where the drag/Shift-sequence started; `focus` is the current end — the same anchor/focus convention as native browser text selection. A single click (no drag) sets `activeCell` and clears `selectionRange` to `null` (no visually distinct 1-cell "selection," just the existing active-cell highlight).
- Add `setSelectionRange`, `extendSelection(to: CellPosition)`, and `clearSelection()` actions. Both `resetUI()` and `setActiveTable()` must clear `selectionRange`.
- **Mouse drag** — `DataTableCell` gets `onMouseDown` (start: `setSelectionRange({anchor: cell, focus: cell})`) and `onMouseEnter` while the mouse button is held (extend: `extendSelection(cell)`); a single top-level `mouseup` listener (mirroring the single global listener already used for keyboard nav) ends the drag.
- **Shift+Click** — extends the range from the existing `activeCell` (or existing anchor) to the clicked cell, without starting a new drag.
- **Shift+Arrow** — new branch in `usePointerKeyboardNav`: when Shift is held with an arrow key, extend `selectionRange.focus` by one cell in that direction instead of moving `activeCell` (existing plain-arrow behavior is unchanged).
- **Visual styling** — a new selection overlay/background applied via the per-cell `isSelected` selector (§3.4), visually distinct from (and layered independently of) the existing active-cell border and nav-band background so both can be legible at once — e.g. selection as a light fill, active cell keeping its current border treatment.
- Selection spans a rectangular row/column range only (no disjoint multi-select via Ctrl+Click) — matches the "contiguous range" scope of this spec (§9).

## 6. New Scope 2: Delete-to-Clear

- **`use-pointer-keyboard-nav.ts`** — add `'Delete'` and `'Backspace'` to the handled key set, guarded exactly like existing nav keys (`enabled`, `recordingState === 'idle'`, `!isTypingTarget(event.target)`).
- On Delete/Backspace: build the target cell list from `selectionRange` if set (all cells in the rectangle), otherwise just `activeCell`. Filter out any cell whose column is `isBaseColumn`/`isReadOnly` (mirror the same check `DataTable`'s `onClick` guard already uses) — locked cells in a mixed selection are silently skipped, not errored on.
- Call `useTableCellStore.getState().updateCellsBatch(tableId, writes)` once with the remaining writable cells, each `value: null` — reuses the existing optimistic-update/rollback/toast-on-failure behavior `updateCellsBatch` already provides, no new error handling needed.
- If every cell in the selection is locked/read-only (nothing to clear), no-op — do not call the batch endpoint with an empty write list.

## 7. New Scope 3: Column/Row Resize

- **State** — new `columnWidths: Record<string, number>` and `rowHeights: Record<string, number>` keyed by `column.id` / `row.id`, persisted via the same `persist`/`partialize` pattern as `ui-store.ts` (either as new fields on that store, or a small sibling store — implementer's call, but must follow the existing persistence convention, not invent a new one). Unset entries fall back to the current hardcoded defaults (`180px` column / `36px` row, matching today's `min-w-[180px]`/`h-9`).
- **Drag handle — columns** — a thin draggable strip on the right edge of `ColumnHeaderCell.tsx`, replacing the static `min-w-[180px]` class with an inline width read from `columnWidths[column.id]` (falling back to the default). Drag delta updates the store on `mouseup` (or live during drag — implementer's call), clamped to a sane minimum (e.g. 60px) so a column can't be dragged to zero/negative width.
- **Drag handle — rows** — a thin draggable strip on the bottom edge of the row (rendered once per row, not per cell, to avoid N duplicate handles) replacing the static `h-9` class with a per-row height read from `rowHeights[row.id]`, same clamping approach (e.g. minimum 24px).
- **Library decision point** — no resize library is currently installed. Implementer must either hand-roll the drag-delta math (consistent with the rest of the codebase's hand-rolled interaction code, e.g. the existing keyboard-nav resolver) or propose a specific library (e.g. `re-resizable`) and get explicit user confirmation per `.claude/rules/architecture.md` "New Libraries" before installing — this spec does not pre-approve one.
- Resize must not interfere with the existing `overflow-x-auto` horizontal scroll wrapper in `DataTable.tsx`, and must not break the fixed row-number/corner cell (`RowIndexCell`, `th.w-10`) which stays a constant width regardless of resize.

---

## 8. Data Contract

```ts
// lib/client/stores/ui-store.ts
interface CellPosition {
  rowKey: string;
  tableColumnId: string;
}

interface SelectionRange {
  anchor: CellPosition;
  focus: CellPosition;
}

// New store fields
selectionRange: SelectionRange | null;
columnWidths: Record<string, number>; // keyed by column.id, px
rowHeights: Record<string, number>;   // keyed by row.id, px
```

```ts
// Delete-to-clear write shape, passed to the existing updateCellsBatch
interface ClearCellWrite {
  rowKey: string;
  tableColumnId: string;
  value: null;
}
```

---

## 9. Out of Scope

- Copy/paste (Ctrl+C / Ctrl+V) across a selection.
- Fill-handle drag-to-fill (Excel-style autofill).
- Collapsing/hiding rows or columns — this spec covers drag-resize of width/height only, not visibility toggling.
- Disjoint (Ctrl+Click) multi-selection — selection is a single contiguous rectangle.
- Resizing the fixed row-number corner column.

---

## 10. Acceptance Criteria

- [ ] Dragging from one cell to another selects the rectangular range between them, visually distinct from the active-cell border and nav-band highlight.
- [ ] Shift+Click and Shift+Arrow both extend the selection from the current anchor without starting a new drag.
- [ ] Pressing Delete or Backspace with a multi-cell selection clears every writable cell's value in a single `updateCellsBatch` call; locked/read-only cells in the selection are skipped, not errored.
- [ ] Pressing Delete/Backspace with only a single active cell (no range) clears that cell, matching current single-cell semantics but without requiring edit-mode entry first.
- [ ] Delete/Backspace does not fire while a cell is in text-edit mode (`isTypingTarget` guard) or while a voice recording is active.
- [ ] Dragging a column's right edge resizes that column only; the new width persists across a page reload.
- [ ] Dragging a row's bottom edge resizes that row only; the new height persists across a page reload.
- [ ] Column/row size cannot be dragged below the defined minimum.
- [ ] Selecting or resizing a large range does not cause `DataTable`'s full `rows.map()` to re-render (verified against the isolation pattern in `docs/features/11_perf_and_navigation.md`).
- [ ] Switching tables (`setActiveTable`) or calling `resetUI()` clears any active selection.

---

## 11. Implementation Order

1. Selection (§5) — `ui-store.ts` state + actions, mouse-drag and Shift-based extension, per-cell `isSelected` visual. Land and verify perf isolation before proceeding.
2. Delete-to-clear (§6) — depends on selection existing (falls back to single active cell if not selected); wires into the already-existing `updateCellsBatch`.
3. Resize (§7) — independent of §5/§6; can be built in parallel, but the library-vs-hand-rolled decision (§7) should be confirmed with the user before implementation starts.

---

## 12. Notes for Reviewers

Two decisions need explicit sign-off before implementation, not just silent implementer choice:

- **Resize library** (§7) — hand-rolled drag math vs. installing a library (e.g. `re-resizable`) is a "new library" decision per `.claude/rules/architecture.md` and must be confirmed with the user, not assumed.
- **`selectionRange` vs. `activeCell` reset paths** (§4, §5) — `resetUI()` and `setActiveTable()` in `ui-store.ts` currently enumerate every piece of transient state explicitly; reviewers should confirm the new `selectionRange` field (and, if added as a third store, the size maps' persistence scope) is wired into both, mirroring how `activeCell` already is.

---

*End of Interactive Grid Spec*
