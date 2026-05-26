# Computed/Formula Columns

**Priority:** Medium  
**Dependencies:** 14_PRODUCT_DATA_FLOW.md  
**Status:** Not Started

---

## Overview

Client-side reactive columns that compute values based on formulas (SUM, AVERAGE, COUNT, etc.) without backend recalculation.

**User Story:**
- User adds a "Total Score" column with formula `=SUM(quiz1, quiz2, final_exam)`
- Column automatically updates when any referenced cell changes
- Formulas support basic arithmetic and aggregation functions
- No database writes for computed values (client-side only)

**Impact:**
- Eliminates manual calculation errors
- Reduces database write operations
- Provides real-time data insights
- Familiar spreadsheet-like experience

---

## Database Schema

```sql
-- Extend tables.schema to include formula columns
-- No new tables needed - store formulas in existing schema JSONB

-- Example schema structure stored in tables.schema:
{
  "columns": [
    {
      "id": "total_score",
      "label": "Total Score",
      "type": "computed",
      "formula": {
        "type": "sum",
        "references": ["quiz1", "quiz2", "final_exam"]
      },
      "metadata": {
        "readonly": true,
        "computed": true
      }
    },
    {
      "id": "average_score",
      "label": "Average Score",
      "type": "computed",
      "formula": {
        "type": "average",
        "references": ["quiz1", "quiz2", "final_exam"],
        "format": "0.00"
      },
      "metadata": {
        "readonly": true,
        "computed": true
      }
    }
  ]
}
```

---

## API Contract

**No new API routes required.** Computation happens client-side.

**Schema Validation (when saving table):**

Example column definition:
```json
{
  "column": {
    "id": "total_score",
    "label": "Total Score",
    "type": "computed",
    "formula": {
      "type": "sum",
      "references": ["quiz1", "quiz2", "final_exam"],
      "format": "0.00"
    },
    "metadata": {
      "readonly": true,
      "computed": true
    }
  }
}
```

Backend validation ensures:
- All referenced columns exist in schema
- Referenced columns are numeric (for math operations)
- No circular dependencies
- Formula type is valid

---

## Type Definitions

```typescript
type FormulaFunction = 
  | 'sum' 
  | 'average' 
  | 'count' 
  | 'min' 
  | 'max' 
  | 'multiply' 
  | 'divide' 
  | 'subtract'
  | 'add';

interface ComputedColumnFormula {
  type: FormulaFunction;
  references: string[];           // Column IDs
  format?: string;                // Number format (e.g., "0.00", "$0,0.00")
  fallback?: number | string;     // Value if computation fails
}

interface ComputedColumn {
  id: string;
  label: string;
  type: 'computed';
  formula: ComputedColumnFormula;
  metadata: {
    readonly: true;
    computed: true;
  };
}

interface FormulaEvaluator {
  evaluate(formula: ComputedColumnFormula, row: Record<string, any>): number | string;
  validate(formula: ComputedColumnFormula, columns: ColumnDef[]): boolean;
  detectCircularDependency(columnId: string, formula: ComputedColumnFormula, allColumns: ComputedColumn[]): boolean;
}

interface FormulaValidationError {
  columnId: string;
  error: 'missing_reference' | 'invalid_type' | 'circular_dependency' | 'invalid_formula';
  message: string;
}
```

**Formula Evaluation Examples:**

```typescript
// SUM
evaluate({ type: 'sum', references: ['a', 'b', 'c'] }, { a: 10, b: 20, c: 30 })
// Returns: 60

// AVERAGE
evaluate({ type: 'average', references: ['a', 'b', 'c'] }, { a: 10, b: 20, c: 30 })
// Returns: 20

// COUNT (counts non-empty values)
evaluate({ type: 'count', references: ['a', 'b', 'c'] }, { a: 10, b: '', c: 30 })
// Returns: 2

// MULTIPLY
evaluate({ type: 'multiply', references: ['price', 'quantity'] }, { price: 10, quantity: 5 })
// Returns: 50

// Formatted output
evaluate({ type: 'average', references: ['a', 'b'], format: '0.00' }, { a: 10, b: 15 })
// Returns: "12.50"
```

---

## Implementation Checklist

**Formula Engine:**
- [ ] Create `lib/formula/evaluator.ts` - Formula evaluation logic
- [ ] Implement SUM function
- [ ] Implement AVERAGE function
- [ ] Implement COUNT function
- [ ] Implement MIN/MAX functions
- [ ] Implement arithmetic operations (multiply, divide, subtract, add)
- [ ] Add error handling for invalid references
- [ ] Add circular dependency detection algorithm
- [ ] Implement number formatting (numeral.js or similar)
- [ ] Handle edge cases (division by zero, empty cells, NaN)

**Validation:**
- [ ] Create `lib/formula/validator.ts`
- [ ] Validate referenced columns exist
- [ ] Validate referenced columns are numeric (for math operations)
- [ ] Prevent circular references (A → B → A)
- [ ] Show validation errors in UI
- [ ] Real-time validation during formula editing

**UI Components:**
- [ ] Formula builder UI (dropdown selector + column picker)
- [ ] Function selector dropdown (SUM, AVERAGE, COUNT, etc.)
- [ ] Column multi-select for references
- [ ] Formula preview with example result
- [ ] Computed column indicator (calculator icon + lock icon)
- [ ] Real-time formula result display in cells
- [ ] Error state for invalid formulas

**React Integration:**
- [ ] Create `useFormulaEvaluator` hook
- [ ] Memoize formula evaluations with `useMemo`
- [ ] Subscribe to row data changes
- [ ] Recalculate computed columns on dependency changes
- [ ] Batch updates for multiple cell changes
- [ ] Debounce recalculations (100ms)

**Performance Optimizations:**
- [ ] Cache evaluation results per row
- [ ] Use React `useMemo` for computed values
- [ ] Batch updates for multiple cell changes
- [ ] Skip evaluation if referenced cells unchanged
- [ ] Limit formula complexity (max 10 references)
- [ ] Web Worker for complex calculations (future)

**Testing:**
- [ ] Unit tests for each formula function
- [ ] Test circular dependency detection
- [ ] Test error handling
- [ ] Test number formatting
- [ ] Test with large datasets (1000+ rows)
- [ ] Performance benchmark (target: <10ms per formula eval)

**Future Enhancements:**
- [ ] Custom JavaScript formulas (sandboxed eval)
- [ ] Cross-table references
- [ ] Conditional formulas (IF/THEN/ELSE)
- [ ] Date/time functions (DATE_DIFF, NOW, etc.)
- [ ] String functions (CONCAT, UPPER, LOWER)
- [ ] Lookup functions (VLOOKUP-style)

---

**Estimated Effort:** 2 weeks  
**Dependencies:** None (client-side only)