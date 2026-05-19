# REFACTOR_LIST_CREATOR.md

**Objective:** Replace the multi-step wizard (`WizardRoot.tsx`, `Step1Info.tsx`, `Step2Schema.tsx`, `Step3DataEntry.tsx`) with a single-page dynamic table interface for creating Base Lists.

**Target Component:** `components/base-lists/DynamicListCreator.tsx`

---

## 1. Component Architecture

### 1.1 File Structure

components/base-lists/
├── DynamicListCreator.tsx          # Main component (replaces wizard)
├── ColumnHeaderCell.tsx            # Editable column header with type dropdown
├── DataCell.tsx                    # Type-aware data input cell
└── types.ts                        # Local types (DO NOT modify existing types.ts)

```
### 1.2 State Management

**Local State (useState):**

```typescript
interface ColumnDef {
  id: string;                           // UUID or timestamp-based
  name: string;                         // User-defined column name
  type: 'text' | 'number' | 'boolean'; // Column data type
}

interface RowData {
  id: string;                           // UUID or timestamp-based
  values: Record<string, string>;       // columnId -> value mapping
}

// Component state
const [listName, setListName] = useState('');
const [description, setDescription] = useState('');
const [columns, setColumns] = useState<ColumnDef[]>([
  { id: 'name', name: 'Name', type: 'text' }  // Default locked column
]);
const [rows, setRows] = useState<RowData[]>([
  { id: 'row_1', values: {} }  // Start with one empty row
]);
```

---

## 2. Layout Structure

### 2.1 Component Hierarchy

```
tsx
<div className="space-y-6 p-6">
  {/* Top Section: Meta Info */}
  <div className="space-y-4">
    <Input name="listName" />
    <Textarea name="description" />
  </div>

  {/* Main Section: Dynamic Table */}
  <div className="border rounded-lg overflow-hidden">
    <table className="w-full">
      {/* Double-Row Header */}
      <thead>
        {/* Row 1: Column Names (Editable Inputs) */}
        <tr className="border-b bg-muted">
          {columns.map((col) => (
            <ColumnHeaderCell key={col.id} column={col} />
          ))}
          <th className="w-12">
            <Button onClick={handleAddColumn} size="icon" variant="ghost">+</Button>
          </th>
        </tr>
        
        {/* Row 2: Column Types (Dropdowns) */}
        <tr className="border-b bg-muted/50">
          {columns.map((col) => (
            <th key={col.id}>
              <Select value={col.type} onValueChange={(type) => updateColumnType(col.id, type)}>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
              </Select>
            </th>
          ))}
          <th></th>
        </tr>
      </thead>

      {/* Data Rows */}
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((col) => (
              <DataCell 
                key={col.id}
                columnId={col.id}
                columnType={col.type}
                value={row.values[col.id] || ''}
                onChange={(val) => updateCell(row.id, col.id, val)}
              />
            ))}
            <td>
              <Button onClick={() => removeRow(row.id)} size="icon" variant="ghost">
                <Trash2 className="h-4 w-4" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {/* Add Row Button */}
    <div className="p-2 border-t">
      <Button onClick={handleAddRow} variant="outline" className="w-full">
        + Add Row
      </Button>
    </div>
  </div>

  {/* Bottom Section: Actions */}
  <div className="flex justify-end gap-2">
    <Button variant="outline" onClick={onCancel}>Cancel</Button>
    <Button onClick={handleSave}>Save List</Button>
  </div>
</div>
```

---

## 3. Core Functions

### 3.1 Column Management

```
typescript
const handleAddColumn = () => {
  const newCol: ColumnDef = {
    id: `col_${Date.now()}`,
    name: '',
    type: 'text',
  };
  setColumns([...columns, newCol]);
};

const updateColumnName = (colId: string, newName: string) => {
  setColumns(columns.map((col) =>
    col.id === colId ? { ...col, name: newName } : col
  ));
};

const updateColumnType = (colId: string, newType: ColumnDef['type']) => {
  setColumns(columns.map((col) =>
    col.id === colId ? { ...col, type: newType } : col
  ));
};

const removeColumn = (colId: string) => {
  if (colId === 'name') return; // Prevent deletion of default column
  
  setColumns(columns.filter((col) => col.id !== colId));
  
  // Remove column values from all rows
  setRows(rows.map((row) => {
    const { [colId]: _, ...rest } = row.values;
    return { ...row, values: rest };
  }));
};
```

### 3.2 Row Management

```
typescript
const handleAddRow = () => {
  const newRow: RowData = {
    id: `row_${Date.now()}`,
    values: {},
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
  if (rows.length === 1) return; // Keep at least one row
  setRows(rows.filter((row) => row.id !== rowId));
};
```

### 3.3 Save Handler

```
typescript
const handleSave = async () => {
  // Validation
  if (!listName.trim()) {
    toast({ title: 'Error', description: 'List name is required' });
    return;
  }

  // Transform to API format
  const payload = {
    name: listName,
    description: description || undefined,
    schema: {
      columns: columns.map((col) => ({
        id: col.id,
        label: col.name,
        type: col.type === 'boolean' ? 'boolean' : col.type === 'number' ? 'number' : 'text',
        validation: col.id === 'name' ? { required: true } : {},
      })),
    },
    entities: rows
      .filter((row) => Object.values(row.values).some((v) => v.trim() !== ''))
      .map((row) => ({ values: row.values })),
  };

  try {
    const response = await fetch('/api/base-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Failed to create list');

    toast({ title: 'Success', description: 'List created successfully' });
    onSuccess?.(); // Callback to refresh parent list
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

## 4. Sub-Components

### 4.1 ColumnHeaderCell.tsx

```
typescript
interface ColumnHeaderCellProps {
  column: ColumnDef;
  onNameChange: (name: string) => void;
  onDelete: () => void;
  isLocked: boolean; // True for default "Name" column
}

export function ColumnHeaderCell({ 
  column, 
  onNameChange, 
  onDelete, 
  isLocked 
}: ColumnHeaderCellProps) {
  return (
    <th className="p-2 bg-muted">
      <div className="flex items-center gap-2">
        <Input
          value={column.name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={isLocked}
          className="h-8 text-sm font-medium"
          placeholder="Column name"
        />
        {!isLocked && (
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
    </th>
  );
}
```

### 4.2 DataCell.tsx

```
typescript
interface DataCellProps {
  columnId: string;
  columnType: 'text' | 'number' | 'boolean';
  value: string;
  onChange: (value: string) => void;
}

export function DataCell({ columnType, value, onChange }: DataCellProps) {
  if (columnType === 'boolean') {
    return (
      <td className="p-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </td>
    );
  }

  return (
    <td className="p-2">
      <Input
        type={columnType === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </td>
  );
}
```

---

## 5. Migration Checklist

### 5.1 Files to Delete
- [ ] `components/base-lists/create-wizard/WizardRoot.tsx`
- [ ] `components/base-lists/create-wizard/Step1Info.tsx`
- [ ] `components/base-lists/create-wizard/Step2Schema.tsx`
- [ ] `components/base-lists/create-wizard/Step3DataEntry.tsx`
- [ ] `components/base-lists/create-wizard/index.ts`

### 5.2 Files to Create
- [ ] `components/base-lists/DynamicListCreator.tsx`
- [ ] `components/base-lists/ColumnHeaderCell.tsx`
- [ ] `components/base-lists/DataCell.tsx`

### 5.3 Files to Update
- [ ] Update parent component imports:
```
typescript
  // Old
  import { CreateListWizard } from '@/components/base-lists/create-wizard';
  
  // New
  import { DynamicListCreator } from '@/components/base-lists/DynamicListCreator';
```

- [ ] Update usage:
```
typescript
  // Old
  <CreateListWizard open={isOpen} onClose={handleClose} />
  
  // New
  <DynamicListCreator 
    open={isOpen} 
    onClose={handleClose}
    onSuccess={handleSuccess}
  />
```

---

## 6. Validation Rules

### 6.1 Pre-Submit Validation

```
typescript
const validate = (): string | null => {
  // List name required
  if (!listName.trim()) {
    return 'List name is required';
  }

  // At least one column (default "Name" column)
  if (columns.length === 0) {
    return 'At least one column is required';
  }

  // All columns must have names
  const emptyColumns = columns.filter((col) => !col.name.trim());
  if (emptyColumns.length > 0) {
    return `${emptyColumns.length} column(s) missing a name`;
  }

  // Column names must be unique
  const names = columns.map((col) => col.name.toLowerCase().trim());
  if (new Set(names).size !== names.length) {
    return 'Column names must be unique';
  }

  return null; // Valid
};
```

---

## 7. Styling Guidelines

### 7.1 Tailwind Classes

```
typescript
// Container
"space-y-6 p-6"

// Meta inputs section
"space-y-4"

// Table container
"border rounded-lg overflow-hidden"

// Header row 1 (column names)
"border-b bg-muted"

// Header row 2 (column types)
"border-b bg-muted/50"

// Data row
"hover:bg-muted/30 transition-colors"

// Add row button container
"p-2 border-t"

// Action buttons container
"flex justify-end gap-2"
```

### 7.2 Component Sizing

- Column header inputs: `h-8 text-sm`
- Type dropdowns: `h-8 text-xs`
- Data cell inputs: `h-9`
- Icon buttons: `h-6 w-6` (header) or `h-9 w-9` (rows)
- Add column button: `size-icon` (square)

---

## 8. API Contract

### 8.1 POST /api/base-lists

**Request Body:**
```
typescript
{
  name: string;                    // Required
  description?: string;            // Optional
  schema: {
    columns: Array<{
      id: string;                  // e.g., "name", "col_123456"
      label: string;               // Display name
      type: 'text' | 'number' | 'boolean' | 'date';
      validation?: {
        required?: boolean;
      };
    }>;
  };
  entities: Array<{
    values: Record<string, string>; // columnId -> value
  }>;
}
```

**Response:**
```
typescript
{
  data: {
    id: string;
    name: string;
    created_at: string;
  };
}
```

---

## 9. Default Column Behavior

### 9.1 Locked "Name" Column

```
typescript
const DEFAULT_COLUMN: ColumnDef = {
  id: 'name',
  name: 'Name',
  type: 'text',
};

// In component initialization
const [columns, setColumns] = useState<ColumnDef[]>([DEFAULT_COLUMN]);

// In delete handler
const removeColumn = (colId: string) => {
  if (colId === 'name') {
    toast({ 
      title: 'Cannot Delete', 
      description: 'The "Name" column is required and cannot be removed.',
      variant: 'destructive',
    });
    return;
  }
  // ... proceed with deletion
};
```

### 9.2 Visual Indicator

```
typescript
// In ColumnHeaderCell component
{column.id === 'name' && (
  <Lock className="h-3 w-3 text-muted-foreground ml-1" />
)}
```

---

## 10. Accessibility

- [ ] Table has `role="table"`
- [ ] Column headers use `<th>` with `scope="col"`
- [ ] Data cells use `<td>`
- [ ] Input fields have `aria-label` attributes
- [ ] Delete buttons have `aria-label="Delete column"` or `aria-label="Delete row"`
- [ ] Keyboard navigation works (Tab, Enter, Escape)

---

## 11. Testing Checklist

- [ ] Create list with default "Name" column only
- [ ] Add 3 custom columns (text, number, boolean)
- [ ] Delete a custom column (verify values removed from rows)
- [ ] Attempt to delete "Name" column (should fail with toast)
- [ ] Add 5 rows
- [ ] Delete rows (verify minimum 1 row maintained)
- [ ] Fill cells with different data types
- [ ] Submit with empty entity rows (should filter out)
- [ ] Submit without list name (should show validation error)
- [ ] Submit with duplicate column names (should show validation error)

---

## 12. Performance Considerations

- **Debounce cell updates:** Use `useDebouncedCallback` for cell onChange handlers
- **Virtualization:** If > 50 rows, consider `react-virtual` for table body
- **Memoization:** Wrap `DataCell` and `ColumnHeaderCell` in `React.memo()`

---

## 13. Implementation Order

1. [ ] Create `DynamicListCreator.tsx` skeleton with state management
2. [ ] Implement top section (name + description inputs)
3. [ ] Implement table structure (static 2-row header)
4. [ ] Add `ColumnHeaderCell` component (editable name + type)
5. [ ] Add `DataCell` component (type-aware input)
6. [ ] Implement column add/delete functions
7. [ ] Implement row add/delete functions
8. [ ] Implement `handleSave` with validation
9. [ ] Add toast notifications
10. [ ] Test all edge cases
11. [ ] Delete old wizard files
12. [ ] Update parent component imports

---

**End of Specification**