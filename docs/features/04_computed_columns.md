# Computed/Formula Columns

**Priority:** Medium
**Dependencies:** 14_PRODUCT_DATA_FLOW.md
**Status:** Implemented (v1)

---

## Overview

Client-side reactive columns that compute values based on aggregation formulas (SUM, AVERAGE, COUNT, MIN, MAX) over other Number columns in the same table, without backend recalculation.

**User Story:**
- User adds a "Total Score" column with SUM over `quiz1`, `quiz2`, `final_exam`
- Column automatically updates when any referenced cell changes
- No database writes for computed values (client-side only)

**v1 scope:**
- Computed columns are configured only at table-creation time, via a simple builder (function dropdown + column checkboxes) — no free-text formula syntax.
- Aggregation functions only: `sum`, `average`, `count`, `min`, `max`. Binary operations (multiply/divide/subtract/add) are deferred.
- References must be Number columns; a computed column cannot reference another computed column (this makes circular dependencies structurally impossible — no cycle-detection algorithm needed).
- Base List columns and other computed columns cannot be referenced.
- Adding/editing computed columns on an *existing* table is out of scope for v1 (no column-add/edit endpoint exists yet).

---

## Storage

Formulas are stored on the relational `TableColumn` row (`prisma/schema.prisma`), not in `Table.schema` JSONB. Plain tables (`createTable`) never populate `Table.schema` JSONB — only the base-list template path does — so JSONB storage would require two divergent write paths. `TableColumn.type` gained a `COMPUTED` enum value and a nullable `formula Json?` column:

```prisma
enum ColumnType {
  TEXT
  NUMBER
  DATE
  BOOLEAN
  COMPUTED
}

model TableColumn {
  ...
  formula Json?
}
```

The `Table.schema` JSONB column definition (`TableSchemaJSON` in `lib/shared/types/models.ts`) also carries an optional `formula` field, so tables created via the template path can round-trip the same shape.

**Reference identifiers:** `formula.references` are stored as real `TableColumn.id` UUIDs. Since the referenced columns don't have ids yet at table-creation time, the client sends `references` as column *keys* (the same slug the server derives from a label — see `lib/shared/utils/column-key.ts`); `createTable` (`lib/server/services/table-service.ts`) resolves those keys to real ids in a second pass immediately after insertion, within the same transaction.

```json
{
  "id": "0f2b...uuid",
  "label": "Total Score",
  "type": "COMPUTED",
  "formula": {
    "type": "sum",
    "references": ["4a1c...uuid", "9d3e...uuid"],
    "precision": 2
  }
}
```

---

## Type Definitions

`lib/shared/types/formula.ts`:

```typescript
type FormulaFunction = 'sum' | 'average' | 'count' | 'min' | 'max';

interface ColumnFormula {
  type: FormulaFunction;
  references: string[];   // referenced column ids, 1-10
  precision?: number;     // decimal places, default 2
  fallback?: string;      // shown when result is null, default "—"
}

interface FormulaValidationError {
  columnId: string;
  error: 'missing_reference' | 'invalid_type' | 'invalid_formula' | 'too_many_references';
  message: string;
}
```

**Blank-cell semantics:** blank/non-numeric references are excluded from SUM/AVERAGE/MIN/MAX. If every reference is blank, the result is `null` and the cell shows the `fallback` string (default `"—"`). `COUNT` counts non-empty numeric references and returns `0`, never `null`.

---

## Formula Engine

`lib/shared/utils/formula.ts` (a pure, shared utility — not `lib/formula/`, per the client/server/shared lib-zone rules in `.claude/rules/architecture.md`):

```typescript
evaluateFormula(formula, getValue: (columnId) => CellValue): number | null
formatFormulaResult(result: number | null, formula: ColumnFormula): string   // Intl.NumberFormat, no external library
validateFormula(columnId, formula, columns: {id, type}[]): FormulaValidationError[]
```

Number formatting uses `Intl.NumberFormat` (no `numeral.js` or other new dependency).

---

## Validation

- Runs client-side in the formula builder (`FormulaBuilderDialog`) and again server-side in `createTable` before any writes.
- Referenced columns must exist and be `NUMBER` type.
- A computed column cannot reference another computed column.
- 1–10 references per formula.

---

## UI

- `components/shared-table/SharedBuilderGrid.tsx` — the row-2 type picker gains a "Computed" option, which opens `FormulaBuilderDialog.tsx`.
- `FormulaBuilderDialog.tsx` — function dropdown, a checkbox list of the grid's eligible Number columns, and a live example-result preview using placeholder sample values.
- `components/shared-table/ComputedCell.tsx` — renders the evaluated result, read-only, with a calculator icon; subscribes to the Zustand cell store (`useTableCellStore`) so it re-renders reactively whenever a referenced cell changes.
- `ColumnHeaderCell.tsx` shows a calculator icon badge for computed columns.

---

## Implementation Checklist

- [x] `lib/shared/utils/formula.ts` — evaluator + validator + formatter
- [x] SUM / AVERAGE / COUNT / MIN / MAX
- [x] Blank/non-numeric handling, division-safe (no divide operations in v1)
- [x] Circular dependency prevention (structural: no computed→computed references)
- [x] `Intl.NumberFormat`-based number formatting
- [x] `FormulaBuilderDialog` — function selector + column checkboxes + live preview
- [x] Computed column indicator (calculator icon)
- [x] `ComputedCell` — reactive, read-only rendering
- [x] Vitest unit tests (`lib/shared/utils/formula.test.ts`)
- [ ] Performance benchmark / large-dataset testing
- [ ] Web Worker for complex calculations

**Future Enhancements (unchanged from original scope):**
- [ ] Add/edit computed columns on existing tables (needs a column-add/edit API route)
- [ ] Binary operations (multiply/divide/subtract/add)
- [ ] Custom JavaScript formulas (sandboxed eval)
- [ ] Cross-table references
- [ ] Conditional formulas (IF/THEN/ELSE)
- [ ] Date/time functions
- [ ] String functions
- [ ] Lookup functions (VLOOKUP-style)
