# Column Visibility/Hiding

**Priority:** Low  
**Dependencies:** 14_PRODUCT_DATA_FLOW.md  
**Status:** Not Started

---

## Overview

Notion-style column hiding to reduce visual clutter without deleting data.

**User Story:**
- User has a table with 15 columns
- User hides irrelevant columns (e.g., "Notes", "Created At")
- Hidden columns stored in user preferences (client-side or database)
- User can toggle visibility via column menu
- Hidden columns remain in database and can be re-shown anytime

**Impact:**
- Improves focus on relevant data
- Reduces horizontal scrolling
- Maintains data integrity (no deletion)
- Personalizes table view per user

---

## Database Schema

```sql
-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  
  hidden_columns TEXT[] DEFAULT '{}',  -- Array of column IDs
  column_order TEXT[],                 -- Custom column order
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, table_id)
);

CREATE INDEX idx_user_prefs_user_table ON user_preferences(user_id, table_id);

-- RLS Policy
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## API Contract

**GET /api/tables/:id/preferences**

Response:
```json
{
  "data": {
    "table_id": "table-uuid",
    "hidden_columns": ["notes", "created_at"],
    "column_order": ["name", "score", "grade"],
    "updated_at": "2025-05-26T12:00:00Z"
  }
}
```

**PATCH /api/tables/:id/preferences**

Request:
```json
{
  "hidden_columns": ["notes", "created_at", "metadata"],
  "column_order": ["name", "student_id", "score", "grade"]
}
```

Response:
```json
{
  "data": {
    "table_id": "table-uuid",
    "hidden_columns": ["notes", "created_at", "metadata"],
    "column_order": ["name", "student_id", "score", "grade"],
    "updated_at": "2025-05-26T12:05:00Z"
  }
}
```

---

## Type Definitions

```typescript
interface UserTablePreferences {
  id: string;
  user_id: string;
  table_id: string;
  hidden_columns: string[];
  column_order?: string[];
  updated_at: string;
}

interface ColumnVisibilityState {
  visible: boolean;
  order: number;
}

type ColumnVisibilityMap = Record<string, ColumnVisibilityState>;

interface ColumnVisibilityAction {
  type: 'HIDE_COLUMN' | 'SHOW_COLUMN' | 'HIDE_ALL' | 'SHOW_ALL' | 'REORDER';
  columnId?: string;
  newOrder?: string[];
}
```

---

## Implementation Checklist

**Database:**
- [ ] Create `user_preferences` table
- [ ] Add RLS policies
- [ ] Create indexes

**API Routes:**
- [ ] GET `/api/tables/:id/preferences` - Get user preferences
- [ ] PATCH `/api/tables/:id/preferences` - Update preferences
- [ ] Handle missing preferences (return defaults)

**UI Components:**
- [ ] Column visibility menu (3-dot menu in header or toolbar)
- [ ] Toggle switch for each column
- [ ] "Show All" / "Hide All" buttons
- [ ] Visual indicator for hidden columns count (e.g., "3 columns hidden")
- [ ] Keyboard shortcut to toggle menu (Cmd+Shift+H)
- [ ] Drag-to-reorder columns (future enhancement)

**State Management:**
- [ ] Add `hiddenColumns` to Zustand table store
- [ ] Add `columnOrder` to Zustand table store
- [ ] Filter columns in table render based on hidden state
- [ ] Persist changes to API on toggle
- [ ] Load preferences on table mount
- [ ] Debounce API calls (500ms)

**Column Filtering Logic:**
```typescript
const visibleColumns = columns.filter(
  (col) => !hiddenColumns.includes(col.id)
);

const orderedColumns = columnOrder
  ? columnOrder
      .map((id) => columns.find((c) => c.id === id))
      .filter(Boolean)
  : visibleColumns;
```

**UX Details:**
- [ ] Smooth fade-out animation when hiding column
- [ ] Show hidden column count badge in toolbar
- [ ] Prevent hiding all columns (keep at least 1 visible)
- [ ] Show warning when hiding last visible column
- [ ] Remember scroll position when toggling columns

**Performance:**
- [ ] Memoize filtered column list
- [ ] Use CSS `display: none` for hidden columns (not conditional rendering)
- [ ] Batch multiple visibility changes
- [ ] Local storage fallback if API fails

**Testing:**
- [ ] Test hide/show single column
- [ ] Test hide/show all columns
- [ ] Test column reordering
- [ ] Test preferences persistence across sessions
- [ ] Test with shared tables (each user has own prefs)
- [ ] Test performance with 50+ columns

---

**Estimated Effort:** 1 week  
**Dependencies:** None