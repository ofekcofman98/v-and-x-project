# REFACTOR_TABLE_CREATOR.md

**Objective:** Replace the table creation wizard with a full-screen, Excel/Notion-like grid interface that supports both generic table creation and Base List injection.

**Target Components:**
- `components/tables/DynamicTableCreator.tsx` (new)
- `components/shared-table/` (shared primitives)
- Refactor existing `DynamicListCreator.tsx` to use shared components

---

---

### 1.2 Shared Types

**File:** `components/shared-table/types.ts`

```typescript
export interface ColumnDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date';
  metadata?: {
    source?: 'base_list' | 'user_defined';     // Track column origin
    baseListColumnId?: string;                  // If from Base List
    locked?: boolean;                           // Prevent deletion/editing
  };
}

export interface RowData {
  id: string;
  values: Record<string, string>;               // columnId -> value
  metadata?: {
    source?: 'base_list' | 'inline';            // Track row origin
    entityId?: string;                          // If from Base List entity
    locked?: boolean;                           // Prevent deletion
  };
}

export interface TableMetadata {
  baseListId?: string;                          // NULL if generic table
  baseListName?: string;                        // Display name
}
```

---

### 1.3 Shared Column Manager Hook

**File:** `components/shared-table/hooks/useColumnManager.ts`

```typescript
import { useState } from 'react';
import type { ColumnDef } from '../types';

export function useColumnManager(initialColumns: ColumnDef[] = []) {
  const [columns, setColumns] = useState<ColumnDef[]>(initialColumns);

  const addColumn = (column?: Partial<ColumnDef>) => {
    const newCol: ColumnDef = {
      id: column?.id || `col_${Date.now()}`,
      name: column?.name || '',
      type: column?.type || 'text',
      metadata: column?.metadata || { source: 'user_defined' },
    };
    setColumns([...columns, newCol]);
  };

  const updateColumn = (id: string, updates: Partial<ColumnDef>) => {
    setColumns(columns.map((col) =>
      col.id === id ? { ...col, ...updates } : col
    ));
  };

  const removeColumn = (id: string) => {
    const col = columns.find((c) => c.id === id);
    if (col?.metadata?.locked) return false; // Cannot delete locked columns
    
    setColumns(columns.filter((c) => c.id !== id));
    return true;
  };

  const reorderColumns = (fromIndex: number, toIndex: number) => {
    const result = Array.from(columns);
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    setColumns(result);
  };

  return {
    columns,
    setColumns,
    addColumn,
    updateColumn,
    removeColumn,
    reorderColumns,
  };
}
```

---

### 1.4 Shared Row Manager Hook

**File:** `components/shared-table/hooks/useRowManager.ts`

```typescript
import { useState } from 'react';
import type { RowData, ColumnDef } from '../types';

export function useRowManager(
  initialRows: RowData[] = [],
  columns: ColumnDef[] = []
) {
  const [rows, setRows] = useState<RowData[]>(initialRows);

  const addRow = (row?: Partial<RowData>) => {
    const newRow: RowData = {
      id: row?.id || `row_${Date.now()}`,
      values: row?.values || {},
      metadata: row?.metadata || { source: 'inline' },
    };
    setRows([...rows, newRow]);
  };

  const updateCell = (rowId: string, colId: string, value: string) => {
    setRows(rows.map((row) =>
      row.id === rowId
        ? { ...row, values: { ...row.values, [colId]: value } }
        : row
    ));
  };

  const removeRow = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (row?.metadata?.locked) return false; // Cannot delete locked rows
    
    setRows(rows.filter((r) => r.id !== rowId));
    return true;
  };

  const clearColumn = (colId: string) => {
    setRows(rows.map((row) => {
      const { [colId]: _, ...rest } = row.values;
      return { ...row, values: rest };
    }));
  };

  return {
    rows,
    setRows,
    addRow,
    updateCell,
    removeRow,
    clearColumn,
  };
}
```

---

### 1.5 Refactored ColumnHeaderCell

**File:** `components/shared-table/ColumnHeaderCell.tsx`

```typescript
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Lock } from 'lucide-react';
import type { ColumnDef } from './types';

interface ColumnHeaderCellProps {
  column: ColumnDef;
  onNameChange: (name: string) => void;
  onTypeChange: (type: ColumnDef['type']) => void;
  onDelete: () => void;
  showTypeSelector?: boolean;        // Optional: hide type selector in some views
}

export function ColumnHeaderCell({
  column,
  onNameChange,
  onTypeChange,
  onDelete,
  showTypeSelector = true,
}: ColumnHeaderCellProps) {
  const isLocked = column.metadata?.locked || false;
  const isFromBaseList = column.metadata?.source === 'base_list';

  return (
    <th className="p-0 border-r last:border-r-0 bg-muted">
      <div className="flex flex-col">
        {/* Row 1: Column Name */}
        <div className="flex items-center gap-2 p-2 border-b">
          <Input
            value={column.name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isLocked}
            className="h-8 text-sm font-medium border-0 bg-transparent"
            placeholder="Column name"
          />
          {isLocked ? (
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <Button
              onClick={onDelete}
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Row 2: Column Type */}
        {showTypeSelector && (
          <div className="p-2">
            <Select
              value={column.type}
              onValueChange={(value) => onTypeChange(value as ColumnDef['type'])}
              disabled={isLocked}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Base List Badge */}
        {isFromBaseList && (
          <div className="px-2 pb-1">
            <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded">
              From Base List
            </span>
          </div>
        )}
      </div>
    </th>
  );
}
```

---

### 1.6 Refactored DataCell

**File:** `components/shared-table/DataCell.tsx`

```typescript
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnDef } from './types';

interface DataCellProps {
  column: ColumnDef;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DataCell({ column, value, onChange, disabled }: DataCellProps) {
  if (column.type === 'boolean') {
    return (
      <td className="p-0 border-r last:border-r-0">
        <div className="p-2">
          <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="h-9 border-0">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </td>
    );
  }

  return (
    <td className="p-0 border-r last:border-r-0">
      <Input
        type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-full min-h-[40px] border-0 rounded-none"
      />
    </td>
  );
}
```

---

### 1.7 Phase 1 Checklist

**Shared Components:**
- [ ] Create `components/shared-table/` directory
- [ ] Move `ColumnHeaderCell.tsx` to shared folder with enhancements
- [ ] Move `DataCell.tsx` to shared folder with enhancements
- [ ] Create `types.ts` with `ColumnDef`, `RowData`, `TableMetadata`
- [ ] Create `useColumnManager.ts` hook
- [ ] Create `useRowManager.ts` hook

**Refactor DynamicListCreator:**
- [ ] Update imports to use `components/shared-table/*`
- [ ] Replace local state with `useColumnManager` hook
- [ ] Replace local state with `useRowManager` hook
- [ ] Remove duplicate component definitions
- [ ] Test existing list creation flow

---

## Phase 2: Full-Screen Table Creator with Base List Injection

### 2.1 Layout Architecture

**File:** `components/tables/DynamicTableCreator.tsx`

```typescript
// Main container: Full-screen grid layout
<div className="fixed inset-0 bg-background z-50 flex">
  {/* Left Sidebar */}
  <div className="w-80 border-r flex flex-col">
    <BaseListSidebar 
      selectedId={selectedBaseListId}
      onSelect={handleBaseListSelect}
    />
  </div>

  {/* Main Grid Area */}
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* Top Bar: Meta Info */}
    <div className="border-b p-4 space-y-3">
      <Input name="tableName" placeholder="Table Name" />
      <Textarea name="description" placeholder="Description" />
      {selectedBaseList && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Database className="h-4 w-4" />
          Using Base List: <strong>{selectedBaseList.name}</strong>
          <Button variant="ghost" size="sm" onClick={clearBaseList}>
            Clear
          </Button>
        </div>
      )}
    </div>

    {/* Grid Container */}
    <div className="flex-1 overflow-auto">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* ... table structure ... */}
          </table>
        </div>
      </div>
    </div>

    {/* Bottom Actions */}
    <div className="border-t p-4 flex justify-between">
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={handleSave}>Save Table</Button>
    </div>
  </div>
</div>
```

---

### 2.2 Base List Sidebar Component

**File:** `components/tables/BaseListSidebar.tsx`

```typescript
import { useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database, Search } from 'lucide-react';
import { useBaseListStore } from '@/lib/stores/base-list-store';

interface BaseListSidebarProps {
  selectedId: string | null;
  onSelect: (baseListId: string) => void;
}

export function BaseListSidebar({ selectedId, onSelect }: BaseListSidebarProps) {
  const { lists, isLoading, fetchLists } = useBaseListStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const filtered = lists.filter((list) =>
    list.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-3">Select Base List</h3>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No base lists found
            </div>
          ) : (
            filtered.map((list) => (
              <Button
                key={list.id}
                variant={selectedId === list.id ? 'secondary' : 'ghost'}
                className="w-full justify-start h-auto py-3 px-3"
                onClick={() => onSelect(list.id)}
              >
                <div className="flex items-start gap-3 w-full">
                  <Database className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 text-left space-y-1">
                    <div className="font-medium text-sm">{list.name}</div>
                    {list.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {list.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {list.entity_count || 0} entities · {list.column_count || 0} columns
                    </div>
                  </div>
                </div>
              </Button>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button variant="outline" className="w-full" size="sm">
          Create New Base List
        </Button>
      </div>
    </div>
  );
}
```

---

### 2.3 Base List Injection Logic

**In:** `components/tables/DynamicTableCreator.tsx`

```typescript
const [selectedBaseListId, setSelectedBaseListId] = useState<string | null>(null);
const [tableMetadata, setTableMetadata] = useState<TableMetadata>({});

const { columns, setColumns, addColumn, updateColumn, removeColumn } = useColumnManager([]);
const { rows, setRows, addRow, updateCell, removeRow } = useRowManager([], columns);

const handleBaseListSelect = async (baseListId: string) => {
  try {
    // Fetch full Base List data with entities
    const response = await fetch(`/api/base-lists/${baseListId}`);
    if (!response.ok) throw new Error('Failed to fetch base list');
    
    const { data: baseList } = await response.json();

    // Inject columns (marked as locked)
    const injectedColumns: ColumnDef[] = baseList.schema.columns.map((col: any) => ({
      id: col.id,
      name: col.label,
      type: col.type,
      metadata: {
        source: 'base_list' as const,
        baseListColumnId: col.id,
        locked: true,
      },
    }));

    setColumns(injectedColumns);

    // Inject rows (marked as locked)
    const injectedRows: RowData[] = baseList.entities.map((entity: any) => ({
      id: entity.id,
      values: entity.values,
      metadata: {
        source: 'base_list' as const,
        entityId: entity.id,
        locked: true,
      },
    }));

    setRows(injectedRows);

    // Update metadata
    setTableMetadata({
      baseListId: baseList.id,
      baseListName: baseList.name,
    });

    setSelectedBaseListId(baseListId);

    toast({
      title: 'Base List Loaded',
      description: `${baseList.name} injected with ${injectedRows.length} entities`,
    });
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to load base list',
      variant: 'destructive',
    });
  }
};

const clearBaseList = () => {
  setColumns([]);
  setRows([{ id: 'row_1', values: {}, metadata: { source: 'inline' } }]);
  setTableMetadata({});
  setSelectedBaseListId(null);
};
```

---

### 2.4 Add Custom Columns (After Base List Injection)

```typescript
const handleAddColumn = () => {
  // New columns added by user are NOT locked
  addColumn({
    id: `col_${Date.now()}`,
    name: '',
    type: 'text',
    metadata: {
      source: 'user_defined',
      locked: false,
    },
  });
};

// In UI: Show "+" button in header row
<th className="w-12 border-r bg-muted">
  <Button onClick={handleAddColumn} size="icon" variant="ghost">
    <Plus className="h-4 w-4" />
  </Button>
</th>
```

---

### 2.5 Visual Distinction for Base List Columns

**In:** `ColumnHeaderCell.tsx` (already implemented in Phase 1)

```typescript
{/* Base List Badge */}
{isFromBaseList && (
  <div className="px-2 pb-1">
    <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded">
      From Base List
    </span>
  </div>
)}
```

---

### 2.6 API Payload Transformation

**File:** `components/tables/DynamicTableCreator.tsx`

```typescript
const handleSave = async () => {
  // Validation
  if (!tableName.trim()) {
    toast({ title: 'Error', description: 'Table name is required' });
    return;
  }

  // Determine representative column (first column for now)
  const representativeColumn = columns[0]?.id;

  if (!representativeColumn) {
    toast({ title: 'Error', description: 'At least one column is required' });
    return;
  }

  // Transform columns
  const apiColumns = columns.map((col) => ({
    id: col.id,
    label: col.name,
    type: col.type,
    validation: {},
    metadata: col.metadata,
  }));

  // Transform rows
  const apiRows = rows
    .filter((row) => Object.values(row.values).some((v) => v?.trim()))
    .map((row) => ({
      id: row.id,
      label: row.values[representativeColumn] || 'Untitled',
      metadata: row.metadata,
    }));

  // Build payload
  const payload = {
    name: tableName,
    description: description || undefined,
    base_list_id: tableMetadata.baseListId || null,
    representative_column: representativeColumn,
    schema: {
      columns: apiColumns,
      rows: apiRows,
    },
    settings: {},
  };

  try {
    const response = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create table');
    }

    const { data } = await response.json();

    toast({ title: 'Success', description: 'Table created successfully' });
    onSuccess?.(data.id);
  } catch (error) {
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Unknown error',
      variant: 'destructive',
    });
  }
};
```

---

### 2.7 Table Grid Layout (Excel-like)

```typescript
<div className="overflow-x-auto">
  <table className="border-collapse">
    <thead>
      {/* Double-row header */}
      <tr>
        {columns.map((col) => (
          <ColumnHeaderCell
            key={col.id}
            column={col}
            onNameChange={(name) => updateColumn(col.id, { name })}
            onTypeChange={(type) => updateColumn(col.id, { type })}
            onDelete={() => removeColumn(col.id)}
            showTypeSelector={true}
          />
        ))}
        <th className="w-12 border-r bg-muted sticky right-0">
          <Button onClick={handleAddColumn} size="icon" variant="ghost">
            <Plus className="h-4 w-4" />
          </Button>
        </th>
      </tr>
    </thead>

    <tbody>
      {rows.map((row, rowIndex) => (
        <tr key={row.id} className="hover:bg-muted/30">
          {columns.map((col) => (
            <DataCell
              key={col.id}
              column={col}
              value={row.values[col.id] || ''}
              onChange={(val) => updateCell(row.id, col.id, val)}
              disabled={row.metadata?.locked}
            />
          ))}
          <td className="p-0 border-r w-12 sticky right-0 bg-background">
            {!row.metadata?.locked && (
              <Button
                onClick={() => removeRow(row.id)}
                size="icon"
                variant="ghost"
                className="h-full w-full rounded-none"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* Add Row Button */}
  <div className="border-t p-2">
    <Button onClick={() => addRow()} variant="outline" className="w-full">
      <Plus className="h-4 w-4 mr-2" />
      Add Row
    </Button>
  </div>
</div>
```

---

### 2.8 Tailwind Layout Specifications

**Full-screen container:**
```css
fixed inset-0 bg-background z-50 flex
```

**Sidebar:**
```css
w-80 border-r flex flex-col
```

**Main grid area:**
```css
flex-1 flex flex-col overflow-hidden
```

**Grid scroll container:**
```css
flex-1 overflow-auto
```

**Table:**
```css
w-full border-collapse
```

**Column header cell:**
```css
p-0 border-r last:border-r-0 bg-muted w-[200px] min-w-[200px]
```

**Data cell:**
```css
p-0 border-r last:border-r-0 w-[200px] min-w-[200px]
```

**Sticky action column:**
```css
w-12 sticky right-0 bg-background border-l
```

---

### 2.9 Phase 2 Checklist

**Component Creation:**
- [ ] Create `components/tables/DynamicTableCreator.tsx`
- [ ] Create `components/tables/BaseListSidebar.tsx`
- [ ] Wire up `useBaseListStore` in sidebar
- [ ] Implement full-screen layout (sidebar + main grid)
- [ ] Add table name and description inputs

**Base List Integration:**
- [ ] Implement `handleBaseListSelect` function
- [ ] Fetch Base List data from API (`/api/base-lists/:id`)
- [ ] Inject columns with `locked: true` metadata
- [ ] Inject rows with `locked: true` metadata
- [ ] Display "From Base List" badge on locked columns
- [ ] Implement `clearBaseList` function
- [ ] Add "Using Base List: X" indicator in top bar

**Custom Column Logic:**
- [ ] Allow adding custom columns after Base List injection
- [ ] Mark custom columns with `source: 'user_defined'`
- [ ] Ensure custom columns are NOT locked
- [ ] Test column deletion (locked vs unlocked)

**Grid Functionality:**
- [ ] Implement double-row header (name + type)
- [ ] Render data cells with type-aware inputs
- [ ] Implement "Add Row" button
- [ ] Implement row deletion (respect locked rows)
- [ ] Add sticky action column on right
- [ ] Test horizontal/vertical scrolling

**API Integration:**
- [ ] Transform state to API payload format
- [ ] Include `base_list_id` in payload (if applicable)
- [ ] Include `representative_column` (first column ID)
- [ ] POST to `/api/tables` endpoint
- [ ] Handle success/error responses
- [ ] Redirect to table detail page on success

**Visual Polish:**
- [ ] Add locked column badges
- [ ] Add locked row indicators (disable delete button)
- [ ] Style Base List selection in sidebar
- [ ] Add search functionality in sidebar
- [ ] Test dark mode compatibility

---

## Phase 3: API Contract & Database Schema

### 3.1 POST /api/tables

**Request Body:**
```typescript
{
  name: string;                           // Required
  description?: string;                   // Optional
  base_list_id?: string | null;          // NULL if generic table
  representative_column: string;          // Column ID for voice matching
  schema: {
    columns: Array<{
      id: string;
      label: string;
      type: 'text' | 'number' | 'date' | 'boolean';
      validation?: {
        required?: boolean;
      };
      metadata?: {
        source?: 'base_list' | 'user_defined';
        baseListColumnId?: string;
        locked?: boolean;
      };
    }>;
    rows: Array<{
      id: string;
      label: string;                      // Representative column value
      metadata?: {
        source?: 'base_list' | 'inline';
        entityId?: string;
        locked?: boolean;
      };
    }>;
  };
  settings?: {
    voice?: {
      defaultMode?: 'column-first' | 'row-first';
    };
  };
}
```

**Response:**
```typescript
{
  data: {
    id: string;
    name: string;
    base_list_id: string | null;
    representative_column: string;
    created_at: string;
  };
}
```

---

### 3.2 Database Writes

**Tables to Update:**

1. **`tables` table:**
```sql
   INSERT INTO tables (
     user_id,
     base_list_id,
     representative_column,
     name,
     description,
     schema,
     settings
   ) VALUES (...);
```

2. **`table_data` table (for initial data):**
```sql
   INSERT INTO table_data (
     table_id,
     entity_id,    -- NULL if inline row
     row_id,
     column_id,
     value
   ) VALUES (...);
```

---

### 3.3 Representative Column Selection

**Current Implementation:**
- Use first column ID as representative column

**Future Enhancement (Optional):**
- Add a "Set as Representative" button in column header
- Visually indicate which column is representative (e.g., star icon)
- Validate that representative column type is `text`

---

## Phase 4: Testing Checklist

### 4.1 Generic Table Creation (No Base List)
- [ ] Create table with custom name
- [ ] Add 3 custom columns (text, number, boolean)
- [ ] Add 5 rows
- [ ] Fill cells with data
- [ ] Delete a column (verify values removed)
- [ ] Delete a row
- [ ] Submit and verify API payload
- [ ] Verify table appears in tables list

### 4.2 Base List Injection
- [ ] Select a Base List from sidebar
- [ ] Verify columns injected and locked
- [ ] Verify rows injected and locked
- [ ] Attempt to delete locked column (should fail)
- [ ] Attempt to delete locked row (should fail)
- [ ] Add custom column after Base List injection
- [ ] Verify custom column is NOT locked
- [ ] Add custom row
- [ ] Fill custom column cells
- [ ] Submit and verify `base_list_id` in payload
- [ ] Verify table-entity relationships in database

### 4.3 Clear Base List
- [ ] Inject Base List
- [ ] Click "Clear" button
- [ ] Verify columns cleared
- [ ] Verify rows reset to one empty row
- [ ] Verify metadata cleared
- [ ] Add custom columns (should work as generic mode)

### 4.4 UI/UX
- [ ] Test sidebar search
- [ ] Test horizontal scrolling (many columns)
- [ ] Test vertical scrolling (many rows)
- [ ] Test sticky action column on right
- [ ] Test locked column badges visible
- [ ] Test "From Base List" indicator in top bar
- [ ] Test responsive layout (minimum width 1280px recommended)

---

## Phase 5: Migration & Cleanup

### 5.1 Files to Delete
- [ ] `components/tables/create-table-dialog.tsx` (old wizard)
- [ ] `components/tables/create-table-wizard/` (if exists)

### 5.2 Files to Update
- [ ] Update parent component imports:
```typescript
  // Old
  import { CreateTableDialog } from '@/components/tables/create-table-dialog';
  
  // New
  import { DynamicTableCreator } from '@/components/tables/DynamicTableCreator';
```

- [ ] Update usage:
```typescript
  // Old
  <CreateTableDialog open={isOpen} onClose={handleClose} />
  
  // New
  <DynamicTableCreator 
    open={isOpen} 
    onClose={handleClose}
    onSuccess={(tableId) => router.push(`/tables/${tableId}`)}
  />
```

### 5.3 Store Updates
- [ ] Ensure `useBaseListStore` has `fetchLists()` method
- [ ] Ensure `useBaseListStore` returns entity count and column count
- [ ] Add `fetchSingleList(id)` method if not exists

---

## Phase 6: Performance Optimizations

### 6.1 Memoization
- [ ] Wrap `ColumnHeaderCell` in `React.memo()`
- [ ] Wrap `DataCell` in `React.memo()`
- [ ] Memoize column and row arrays in hooks
- [ ] Use `useMemo` for filtered/sorted data

### 6.2 Virtualization (If > 50 rows)
- [ ] Install `@tanstack/react-virtual`
- [ ] Implement virtual scrolling for table body
- [ ] Maintain sticky header

### 6.3 Debouncing
- [ ] Debounce cell onChange handlers (300ms)
- [ ] Debounce column name updates (500ms)

---

## Implementation Priority

1. **Week 1: Phase 1** - Shared component extraction and refactor
2. **Week 2: Phase 2** - Full-screen layout and Base List injection
3. **Week 3: Phase 3-4** - API integration and testing
4. **Week 4: Phase 5-6** - Migration, cleanup, and optimization

---


## Phase 1: Shared Component Extraction & Generic Table Creator

### 1.1 Shared Components Architecture

**New Directory Structure:**

components/
├── shared-table/
│   ├── ColumnHeaderCell.tsx       # Reusable column header with type dropdown
│   ├── DataCell.tsx                # Type-aware data input cell
│   ├── types.ts                    # Shared types for columns/rows
│   └── hooks/
│       ├── useColumnManager.ts     # Column CRUD operations
│       └── useRowManager.ts        # Row CRUD operations
├── base-lists/
│   └── DynamicListCreator.tsx      # Refactored to use shared components
└── tables/
├── DynamicTableCreator.tsx     # New full-screen grid interface
└── BaseListSidebar.tsx         # Base List selection panel

---

### 1.2 Shared Types

**File:** `components/shared-table/types.ts`

```typescript
export interface ColumnDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date';
  metadata?: {
    source?: 'base_list' | 'user_defined';     // Track column origin
    baseListColumnId?: string;                  // If from Base List
    locked?: boolean;                           // Prevent deletion/editing
  };
}

export interface RowData {
  id: string;
  values: Record<string, string>;               // columnId -> value
  metadata?: {
    source?: 'base_list' | 'inline';            // Track row origin
    entityId?: string;                          // If from Base List entity
    locked?: boolean;                           // Prevent deletion
  };
}

export interface TableMetadata {
  baseListId?: string;                          // NULL if generic table
  baseListName?: string;                        // Display name
}
```

---

### 1.3 Shared Column Manager Hook

**File:** `components/shared-table/hooks/useColumnManager.ts`

```typescript
import { useState } from 'react';
import type { ColumnDef } from '../types';

export function useColumnManager(initialColumns: ColumnDef[] = []) {
  const [columns, setColumns] = useState<ColumnDef[]>(initialColumns);

  const addColumn = (column?: Partial<ColumnDef>) => {
    const newCol: ColumnDef = {
      id: column?.id || `col_${Date.now()}`,
      name: column?.name || '',
      type: column?.type || 'text',
      metadata: column?.metadata || { source: 'user_defined' },
    };
    setColumns([...columns, newCol]);
  };

  const updateColumn = (id: string, updates: Partial<ColumnDef>) => {
    setColumns(columns.map((col) =>
      col.id === id ? { ...col, ...updates } : col
    ));
  };

  const removeColumn = (id: string) => {
    const col = columns.find((c) => c.id === id);
    if (col?.metadata?.locked) return false; // Cannot delete locked columns
    
    setColumns(columns.filter((c) => c.id !== id));
    return true;
  };

  const reorderColumns = (fromIndex: number, toIndex: number) => {
    const result = Array.from(columns);
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    setColumns(result);
  };

  return {
    columns,
    setColumns,
    addColumn,
    updateColumn,
    removeColumn,
    reorderColumns,
  };
}
```

---

### 1.4 Shared Row Manager Hook

**File:** `components/shared-table/hooks/useRowManager.ts`

```typescript
import { useState } from 'react';
import type { RowData, ColumnDef } from '../types';

export function useRowManager(
  initialRows: RowData[] = [],
  columns: ColumnDef[] = []
) {
  const [rows, setRows] = useState<RowData[]>(initialRows);

  const addRow = (row?: Partial<RowData>) => {
    const newRow: RowData = {
      id: row?.id || `row_${Date.now()}`,
      values: row?.values || {},
      metadata: row?.metadata || { source: 'inline' },
    };
    setRows([...rows, newRow]);
  };

  const updateCell = (rowId: string, colId: string, value: string) => {
    setRows(rows.map((row) =>
      row.id === rowId
        ? { ...row, values: { ...row.values, [colId]: value } }
        : row
    ));
  };

  const removeRow = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (row?.metadata?.locked) return false; // Cannot delete locked rows
    
    setRows(rows.filter((r) => r.id !== rowId));
    return true;
  };

  const clearColumn = (colId: string) => {
    setRows(rows.map((row) => {
      const { [colId]: _, ...rest } = row.values;
      return { ...row, values: rest };
    }));
  };

  return {
    rows,
    setRows,
    addRow,
    updateCell,
    removeRow,
    clearColumn,
  };
}
```

---

### 1.5 Refactored ColumnHeaderCell

**File:** `components/shared-table/ColumnHeaderCell.tsx`

```typescript
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Lock } from 'lucide-react';
import type { ColumnDef } from './types';

interface ColumnHeaderCellProps {
  column: ColumnDef;
  onNameChange: (name: string) => void;
  onTypeChange: (type: ColumnDef['type']) => void;
  onDelete: () => void;
  showTypeSelector?: boolean;        // Optional: hide type selector in some views
}

export function ColumnHeaderCell({
  column,
  onNameChange,
  onTypeChange,
  onDelete,
  showTypeSelector = true,
}: ColumnHeaderCellProps) {
  const isLocked = column.metadata?.locked || false;
  const isFromBaseList = column.metadata?.source === 'base_list';

  return (
    <th className="p-0 border-r last:border-r-0 bg-muted">
      <div className="flex flex-col">
        {/* Row 1: Column Name */}
        <div className="flex items-center gap-2 p-2 border-b">
          <Input
            value={column.name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isLocked}
            className="h-8 text-sm font-medium border-0 bg-transparent"
            placeholder="Column name"
          />
          {isLocked ? (
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <Button
              onClick={onDelete}
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Row 2: Column Type */}
        {showTypeSelector && (
          <div className="p-2">
            <Select
              value={column.type}
              onValueChange={(value) => onTypeChange(value as ColumnDef['type'])}
              disabled={isLocked}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Base List Badge */}
        {isFromBaseList && (
          <div className="px-2 pb-1">
            <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded">
              From Base List
            </span>
          </div>
        )}
      </div>
    </th>
  );
}
```

---

### 1.6 Refactored DataCell

**File:** `components/shared-table/DataCell.tsx`

```typescript
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnDef } from './types';

interface DataCellProps {
  column: ColumnDef;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DataCell({ column, value, onChange, disabled }: DataCellProps) {
  if (column.type === 'boolean') {
    return (
      <td className="p-0 border-r last:border-r-0">
        <div className="p-2">
          <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="h-9 border-0">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </td>
    );
  }

  return (
    <td className="p-0 border-r last:border-r-0">
      <Input
        type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-full min-h-[40px] border-0 rounded-none"
      />
    </td>
  );
}
```

---

### 1.7 Phase 1 Checklist

**Shared Components:**
- [ ] Create `components/shared-table/` directory
- [ ] Move `ColumnHeaderCell.tsx` to shared folder with enhancements
- [ ] Move `DataCell.tsx` to shared folder with enhancements
- [ ] Create `types.ts` with `ColumnDef`, `RowData`, `TableMetadata`
- [ ] Create `useColumnManager.ts` hook
- [ ] Create `useRowManager.ts` hook

**Refactor DynamicListCreator:**
- [ ] Update imports to use `components/shared-table/*`
- [ ] Replace local state with `useColumnManager` hook
- [ ] Replace local state with `useRowManager` hook
- [ ] Remove duplicate component definitions
- [ ] Test existing list creation flow

---

## Phase 2: Full-Screen Table Creator with Base List Injection

### 2.1 Layout Architecture

**File:** `components/tables/DynamicTableCreator.tsx`

```typescript
// Main container: Full-screen grid layout
<div className="fixed inset-0 bg-background z-50 flex">
  {/* Left Sidebar */}
  <div className="w-80 border-r flex flex-col">
    <BaseListSidebar 
      selectedId={selectedBaseListId}
      onSelect={handleBaseListSelect}
    />
  </div>

  {/* Main Grid Area */}
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* Top Bar: Meta Info */}
    <div className="border-b p-4 space-y-3">
      <Input name="tableName" placeholder="Table Name" />
      <Textarea name="description" placeholder="Description" />
      {selectedBaseList && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Database className="h-4 w-4" />
          Using Base List: <strong>{selectedBaseList.name}</strong>
          <Button variant="ghost" size="sm" onClick={clearBaseList}>
            Clear
          </Button>
        </div>
      )}
    </div>

    {/* Grid Container */}
    <div className="flex-1 overflow-auto">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* ... table structure ... */}
          </table>
        </div>
      </div>
    </div>

    {/* Bottom Actions */}
    <div className="border-t p-4 flex justify-between">
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={handleSave}>Save Table</Button>
    </div>
  </div>
</div>
```

---

### 2.2 Base List Sidebar Component

**File:** `components/tables/BaseListSidebar.tsx`

```typescript
import { useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database, Search } from 'lucide-react';
import { useBaseListStore } from '@/lib/stores/base-list-store';

interface BaseListSidebarProps {
  selectedId: string | null;
  onSelect: (baseListId: string) => void;
}

export function BaseListSidebar({ selectedId, onSelect }: BaseListSidebarProps) {
  const { lists, isLoading, fetchLists } = useBaseListStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const filtered = lists.filter((list) =>
    list.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-3">Select Base List</h3>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No base lists found
            </div>
          ) : (
            filtered.map((list) => (
              <Button
                key={list.id}
                variant={selectedId === list.id ? 'secondary' : 'ghost'}
                className="w-full justify-start h-auto py-3 px-3"
                onClick={() => onSelect(list.id)}
              >
                <div className="flex items-start gap-3 w-full">
                  <Database className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 text-left space-y-1">
                    <div className="font-medium text-sm">{list.name}</div>
                    {list.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {list.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {list.entity_count || 0} entities · {list.column_count || 0} columns
                    </div>
                  </div>
                </div>
              </Button>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button variant="outline" className="w-full" size="sm">
          Create New Base List
        </Button>
      </div>
    </div>
  );
}
```

---

### 2.3 Base List Injection Logic

**In:** `components/tables/DynamicTableCreator.tsx`

```typescript
const [selectedBaseListId, setSelectedBaseListId] = useState<string | null>(null);
const [tableMetadata, setTableMetadata] = useState<TableMetadata>({});

const { columns, setColumns, addColumn, updateColumn, removeColumn } = useColumnManager([]);
const { rows, setRows, addRow, updateCell, removeRow } = useRowManager([], columns);

const handleBaseListSelect = async (baseListId: string) => {
  try {
    // Fetch full Base List data with entities
    const response = await fetch(`/api/base-lists/${baseListId}`);
    if (!response.ok) throw new Error('Failed to fetch base list');
    
    const { data: baseList } = await response.json();

    // Inject columns (marked as locked)
    const injectedColumns: ColumnDef[] = baseList.schema.columns.map((col: any) => ({
      id: col.id,
      name: col.label,
      type: col.type,
      metadata: {
        source: 'base_list' as const,
        baseListColumnId: col.id,
        locked: true,
      },
    }));

    setColumns(injectedColumns);

    // Inject rows (marked as locked)
    const injectedRows: RowData[] = baseList.entities.map((entity: any) => ({
      id: entity.id,
      values: entity.values,
      metadata: {
        source: 'base_list' as const,
        entityId: entity.id,
        locked: true,
      },
    }));

    setRows(injectedRows);

    // Update metadata
    setTableMetadata({
      baseListId: baseList.id,
      baseListName: baseList.name,
    });

    setSelectedBaseListId(baseListId);

    toast({
      title: 'Base List Loaded',
      description: `${baseList.name} injected with ${injectedRows.length} entities`,
    });
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to load base list',
      variant: 'destructive',
    });
  }
};

const clearBaseList = () => {
  setColumns([]);
  setRows([{ id: 'row_1', values: {}, metadata: { source: 'inline' } }]);
  setTableMetadata({});
  setSelectedBaseListId(null);
};
```

---

### 2.4 Add Custom Columns (After Base List Injection)

```typescript
const handleAddColumn = () => {
  // New columns added by user are NOT locked
  addColumn({
    id: `col_${Date.now()}`,
    name: '',
    type: 'text',
    metadata: {
      source: 'user_defined',
      locked: false,
    },
  });
};

// In UI: Show "+" button in header row
<th className="w-12 border-r bg-muted">
  <Button onClick={handleAddColumn} size="icon" variant="ghost">
    <Plus className="h-4 w-4" />
  </Button>
</th>
```

---

### 2.5 Visual Distinction for Base List Columns

**In:** `ColumnHeaderCell.tsx` (already implemented in Phase 1)

```typescript
{/* Base List Badge */}
{isFromBaseList && (
  <div className="px-2 pb-1">
    <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded">
      From Base List
    </span>
  </div>
)}
```

---

### 2.6 API Payload Transformation

**File:** `components/tables/DynamicTableCreator.tsx`

```typescript
const handleSave = async () => {
  // Validation
  if (!tableName.trim()) {
    toast({ title: 'Error', description: 'Table name is required' });
    return;
  }

  // Determine representative column (first column for now)
  const representativeColumn = columns[0]?.id;

  if (!representativeColumn) {
    toast({ title: 'Error', description: 'At least one column is required' });
    return;
  }

  // Transform columns
  const apiColumns = columns.map((col) => ({
    id: col.id,
    label: col.name,
    type: col.type,
    validation: {},
    metadata: col.metadata,
  }));

  // Transform rows
  const apiRows = rows
    .filter((row) => Object.values(row.values).some((v) => v?.trim()))
    .map((row) => ({
      id: row.id,
      label: row.values[representativeColumn] || 'Untitled',
      metadata: row.metadata,
    }));

  // Build payload
  const payload = {
    name: tableName,
    description: description || undefined,
    base_list_id: tableMetadata.baseListId || null,
    representative_column: representativeColumn,
    schema: {
      columns: apiColumns,
      rows: apiRows,
    },
    settings: {},
  };

  try {
    const response = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create table');
    }

    const { data } = await response.json();

    toast({ title: 'Success', description: 'Table created successfully' });
    onSuccess?.(data.id);
  } catch (error) {
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Unknown error',
      variant: 'destructive',
    });
  }
};
```

---

### 2.7 Table Grid Layout (Excel-like)

```typescript
<div className="overflow-x-auto">
  <table className="border-collapse">
    <thead>
      {/* Double-row header */}
      <tr>
        {columns.map((col) => (
          <ColumnHeaderCell
            key={col.id}
            column={col}
            onNameChange={(name) => updateColumn(col.id, { name })}
            onTypeChange={(type) => updateColumn(col.id, { type })}
            onDelete={() => removeColumn(col.id)}
            showTypeSelector={true}
          />
        ))}
        <th className="w-12 border-r bg-muted sticky right-0">
          <Button onClick={handleAddColumn} size="icon" variant="ghost">
            <Plus className="h-4 w-4" />
          </Button>
        </th>
      </tr>
    </thead>

    <tbody>
      {rows.map((row, rowIndex) => (
        <tr key={row.id} className="hover:bg-muted/30">
          {columns.map((col) => (
            <DataCell
              key={col.id}
              column={col}
              value={row.values[col.id] || ''}
              onChange={(val) => updateCell(row.id, col.id, val)}
              disabled={row.metadata?.locked}
            />
          ))}
          <td className="p-0 border-r w-12 sticky right-0 bg-background">
            {!row.metadata?.locked && (
              <Button
                onClick={() => removeRow(row.id)}
                size="icon"
                variant="ghost"
                className="h-full w-full rounded-none"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* Add Row Button */}
  <div className="border-t p-2">
    <Button onClick={() => addRow()} variant="outline" className="w-full">
      <Plus className="h-4 w-4 mr-2" />
      Add Row
    </Button>
  </div>
</div>
```

---

### 2.8 Tailwind Layout Specifications

**Full-screen container:**
```css
fixed inset-0 bg-background z-50 flex
```

**Sidebar:**
```css
w-80 border-r flex flex-col
```

**Main grid area:**
```css
flex-1 flex flex-col overflow-hidden
```

**Grid scroll container:**
```css
flex-1 overflow-auto
```

**Table:**
```css
w-full border-collapse
```

**Column header cell:**
```css
p-0 border-r last:border-r-0 bg-muted w-[200px] min-w-[200px]
```

**Data cell:**
```css
p-0 border-r last:border-r-0 w-[200px] min-w-[200px]
```

**Sticky action column:**
```css
w-12 sticky right-0 bg-background border-l
```

---

### 2.9 Phase 2 Checklist

**Component Creation:**
- [ ] Create `components/tables/DynamicTableCreator.tsx`
- [ ] Create `components/tables/BaseListSidebar.tsx`
- [ ] Wire up `useBaseListStore` in sidebar
- [ ] Implement full-screen layout (sidebar + main grid)
- [ ] Add table name and description inputs

**Base List Integration:**
- [ ] Implement `handleBaseListSelect` function
- [ ] Fetch Base List data from API (`/api/base-lists/:id`)
- [ ] Inject columns with `locked: true` metadata
- [ ] Inject rows with `locked: true` metadata
- [ ] Display "From Base List" badge on locked columns
- [ ] Implement `clearBaseList` function
- [ ] Add "Using Base List: X" indicator in top bar

**Custom Column Logic:**
- [ ] Allow adding custom columns after Base List injection
- [ ] Mark custom columns with `source: 'user_defined'`
- [ ] Ensure custom columns are NOT locked
- [ ] Test column deletion (locked vs unlocked)

**Grid Functionality:**
- [ ] Implement double-row header (name + type)
- [ ] Render data cells with type-aware inputs
- [ ] Implement "Add Row" button
- [ ] Implement row deletion (respect locked rows)
- [ ] Add sticky action column on right
- [ ] Test horizontal/vertical scrolling

**API Integration:**
- [ ] Transform state to API payload format
- [ ] Include `base_list_id` in payload (if applicable)
- [ ] Include `representative_column` (first column ID)
- [ ] POST to `/api/tables` endpoint
- [ ] Handle success/error responses
- [ ] Redirect to table detail page on success

**Visual Polish:**
- [ ] Add locked column badges
- [ ] Add locked row indicators (disable delete button)
- [ ] Style Base List selection in sidebar
- [ ] Add search functionality in sidebar
- [ ] Test dark mode compatibility

---

## Phase 3: API Contract & Database Schema

### 3.1 POST /api/tables

**Request Body:**
```typescript
{
  name: string;                           // Required
  description?: string;                   // Optional
  base_list_id?: string | null;          // NULL if generic table
  representative_column: string;          // Column ID for voice matching
  schema: {
    columns: Array<{
      id: string;
      label: string;
      type: 'text' | 'number' | 'date' | 'boolean';
      validation?: {
        required?: boolean;
      };
      metadata?: {
        source?: 'base_list' | 'user_defined';
        baseListColumnId?: string;
        locked?: boolean;
      };
    }>;
    rows: Array<{
      id: string;
      label: string;                      // Representative column value
      metadata?: {
        source?: 'base_list' | 'inline';
        entityId?: string;
        locked?: boolean;
      };
    }>;
  };
  settings?: {
    voice?: {
      defaultMode?: 'column-first' | 'row-first';
    };
  };
}
```

**Response:**
```typescript
{
  data: {
    id: string;
    name: string;
    base_list_id: string | null;
    representative_column: string;
    created_at: string;
  };
}
```

---

### 3.2 Database Writes

**Tables to Update:**

1. **`tables` table:**
```sql
   INSERT INTO tables (
     user_id,
     base_list_id,
     representative_column,
     name,
     description,
     schema,
     settings
   ) VALUES (...);
```

2. **`table_data` table (for initial data):**
```sql
   INSERT INTO table_data (
     table_id,
     entity_id,    -- NULL if inline row
     row_id,
     column_id,
     value
   ) VALUES (...);
```

---

### 3.3 Representative Column Selection

**Current Implementation:**
- Use first column ID as representative column

**Future Enhancement (Optional):**
- Add a "Set as Representative" button in column header
- Visually indicate which column is representative (e.g., star icon)
- Validate that representative column type is `text`

---

## Phase 4: Testing Checklist

### 4.1 Generic Table Creation (No Base List)
- [ ] Create table with custom name
- [ ] Add 3 custom columns (text, number, boolean)
- [ ] Add 5 rows
- [ ] Fill cells with data
- [ ] Delete a column (verify values removed)
- [ ] Delete a row
- [ ] Submit and verify API payload
- [ ] Verify table appears in tables list

### 4.2 Base List Injection
- [ ] Select a Base List from sidebar
- [ ] Verify columns injected and locked
- [ ] Verify rows injected and locked
- [ ] Attempt to delete locked column (should fail)
- [ ] Attempt to delete locked row (should fail)
- [ ] Add custom column after Base List injection
- [ ] Verify custom column is NOT locked
- [ ] Add custom row
- [ ] Fill custom column cells
- [ ] Submit and verify `base_list_id` in payload
- [ ] Verify table-entity relationships in database

### 4.3 Clear Base List
- [ ] Inject Base List
- [ ] Click "Clear" button
- [ ] Verify columns cleared
- [ ] Verify rows reset to one empty row
- [ ] Verify metadata cleared
- [ ] Add custom columns (should work as generic mode)

### 4.4 UI/UX
- [ ] Test sidebar search
- [ ] Test horizontal scrolling (many columns)
- [ ] Test vertical scrolling (many rows)
- [ ] Test sticky action column on right
- [ ] Test locked column badges visible
- [ ] Test "From Base List" indicator in top bar
- [ ] Test responsive layout (minimum width 1280px recommended)

---

## Phase 5: Migration & Cleanup

### 5.1 Files to Delete
- [ ] `components/tables/create-table-dialog.tsx` (old wizard)
- [ ] `components/tables/create-table-wizard/` (if exists)

### 5.2 Files to Update
- [ ] Update parent component imports:
```typescript
  // Old
  import { CreateTableDialog } from '@/components/tables/create-table-dialog';
  
  // New
  import { DynamicTableCreator } from '@/components/tables/DynamicTableCreator';
```

- [ ] Update usage:
```typescript
  // Old
  <CreateTableDialog open={isOpen} onClose={handleClose} />
  
  // New
  <DynamicTableCreator 
    open={isOpen} 
    onClose={handleClose}
    onSuccess={(tableId) => router.push(`/tables/${tableId}`)}
  />
```

### 5.3 Store Updates
- [ ] Ensure `useBaseListStore` has `fetchLists()` method
- [ ] Ensure `useBaseListStore` returns entity count and column count
- [ ] Add `fetchSingleList(id)` method if not exists

---

## Phase 6: Performance Optimizations

### 6.1 Memoization
- [ ] Wrap `ColumnHeaderCell` in `React.memo()`
- [ ] Wrap `DataCell` in `React.memo()`
- [ ] Memoize column and row arrays in hooks
- [ ] Use `useMemo` for filtered/sorted data

### 6.2 Virtualization (If > 50 rows)
- [ ] Install `@tanstack/react-virtual`
- [ ] Implement virtual scrolling for table body
- [ ] Maintain sticky header

### 6.3 Debouncing
- [ ] Debounce cell onChange handlers (300ms)
- [ ] Debounce column name updates (500ms)

---

## Implementation Priority

1. **Week 1: Phase 1** - Shared component extraction and refactor
2. **Week 2: Phase 2** - Full-screen layout and Base List injection
3. **Week 3: Phase 3-4** - API integration and testing
4. **Week 4: Phase 5-6** - Migration, cleanup, and optimization

---

**End of Specification**