# DataTable Component

A fully functional spreadsheet-like grid component with Smart Pointer integration for VocalGrid.

## Components

### DataTable
The main table component that renders a grid view on desktop/tablet.

**Location:** `components/table/DataTable.tsx`

**Features:**
- ✅ Spreadsheet-like grid layout
- ✅ Smart Pointer (Active Cell) highlighting
- ✅ Click to select cells
- ✅ Dynamic recording state visualization
- ✅ Sticky row/column headers
- ✅ Responsive design
- ✅ Dark mode support

### DataTableCell
Individual cell component with Smart Pointer integration.

**Location:** `components/table/DataTableCell.tsx`

**Features:**
- ✅ Active cell highlight (blue border)
- ✅ Visual state indicators for voice recording
- ✅ Corner indicator for active cell
- ✅ Success animation on commit
- ✅ Type-based value formatting

### MobileTableView
Card-based view optimized for mobile devices.

**Location:** `components/table/MobileTableView.tsx`

**Features:**
- ✅ Expandable row cards
- ✅ Touch-friendly interface
- ✅ Same Smart Pointer integration
- ✅ Responsive to viewport changes

## Usage

### Basic Example

```tsx
import { DataTable } from '@/components/table';
import type { ColumnDefinition, RowDefinition, CellData } from '@/components/table';

const columns: ColumnDefinition[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'score', label: 'Score', type: 'number' },
  { id: 'passed', label: 'Passed', type: 'boolean' },
];

const rows: RowDefinition[] = [
  { id: 'row1', label: 'Student 1' },
  { id: 'row2', label: 'Student 2' },
];

const data: CellData[] = [
  { rowId: 'row1', columnId: 'name', value: 'Alice' },
  { rowId: 'row1', columnId: 'score', value: 95 },
  { rowId: 'row1', columnId: 'passed', value: true },
];

export function MyTable() {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      data={data}
      onCellClick={(rowId, columnId) => {
        console.log('Cell clicked:', rowId, columnId);
      }}
    />
  );
}
```

### Smart Pointer Integration

The DataTable is connected to the UI Store (`lib/stores/ui-store.ts`) which manages the active cell state.

**Triggering the Active Cell Highlight:**

```tsx
import { useUIStore } from '@/lib/stores/ui-store';

function MyComponent() {
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  
  // Set active cell programmatically
  const selectCell = () => {
    setActiveCell({ rowId: 'row1', columnId: 'name' });
  };
  
  // Clear active cell
  const clearSelection = () => {
    setActiveCell(null);
  };
  
  return (
    <div>
      <button onClick={selectCell}>Select Cell</button>
      <button onClick={clearSelection}>Clear</button>
    </div>
  );
}
```

### Recording State Visualization

The active cell changes appearance based on the voice recording state:

```tsx
import { useUIStore } from '@/lib/stores/ui-store';

function VoiceControls() {
  const setRecordingState = useUIStore((state) => state.setRecordingState);
  
  return (
    <div>
      <button onClick={() => setRecordingState('listening')}>
        Start Recording
      </button>
      <button onClick={() => setRecordingState('processing')}>
        Process Audio
      </button>
      <button onClick={() => setRecordingState('confirming')}>
        Show Confirmation
      </button>
      <button onClick={() => setRecordingState('committing')}>
        Commit Data
      </button>
      <button onClick={() => setRecordingState('idle')}>
        Reset
      </button>
    </div>
  );
}
```

### Recording States & Visual Feedback

| State | Cell Background | Description |
|-------|----------------|-------------|
| `idle` | Blue highlight | Cell is selected but no recording |
| `listening` | Blue + pulsing | Recording audio input |
| `processing` | Yellow tint | Transcribing/parsing audio |
| `confirming` | Orange tint | Waiting for user confirmation |
| `committing` | Green flash | Saving to database |

## Demo Page

Visit `/demo/table` to see the DataTable in action with interactive controls.

**Demo Features:**
- Click any cell to highlight it
- Simulate different recording states
- Quick-select specific cells
- Test on different screen sizes

## Mobile vs Desktop

The component automatically adapts:

- **Desktop/Tablet (≥1024px):** Full grid table view
- **Mobile (<1024px):** Card-based expandable rows

Both views use the same Smart Pointer state.

## Props

### DataTable Props

```typescript
interface DataTableProps {
  columns: ColumnDefinition[];
  rows: RowDefinition[];
  data: CellData[];
  onCellClick?: (rowId: string, columnId: string) => void;
}
```

### Column Definition

```typescript
interface ColumnDefinition {
  id: string;              // Unique identifier
  label: string;           // Display name
  type: 'text' | 'number' | 'boolean' | 'date';
}
```

### Row Definition

```typescript
interface RowDefinition {
  id: string;              // Unique identifier
  label: string;           // Display name
}
```

### Cell Data

```typescript
interface CellData {
  rowId: string;
  columnId: string;
  value: string | number | boolean | null;
}
```

## Accessibility

- ✅ Semantic HTML table structure
- ✅ Keyboard navigation support (to be added)
- ✅ Screen reader compatible
- ✅ High contrast mode support
- ✅ Focus management (to be added)

## Next Steps

1. **Keyboard Navigation:** Arrow keys to move active cell
2. **Voice Integration:** Connect to voice recording pipeline
3. **Database Integration:** Connect to Supabase for real data
4. **Animations:** Add framer-motion for smooth transitions
5. **Context Menu:** Right-click cell options
6. **Bulk Selection:** Multi-cell selection

## Related Documentation

- `docs/08_UI_COMPONENTS.md` - Full UI component specification
- `docs/06_SMART_POINTER.md` - Smart Pointer logic
- `docs/04_STATE_MANAGEMENT.md` - State management with Zustand
- `docs/03_DATABASE.md` - Data structure and schema
