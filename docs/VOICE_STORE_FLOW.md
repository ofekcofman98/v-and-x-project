# Voice-to-Store Data Flow

## High-Confidence Match Flow (>0.8)

```mermaid
sequenceDiagram
    participant User
    participant VoiceButton
    participant API as /api/voice-entry
    participant FuzzyMatch
    participant TableStore as useTableDataStore
    participant UIStore as useUIStore
    participant DataTableCell

    User->>VoiceButton: Speaks "Student B 95"
    VoiceButton->>API: POST audio + schema + activeCell
    API-->>VoiceButton: ParsedResult (entity, value)
    VoiceButton->>FuzzyMatch: Match "Student B" against rows
    FuzzyMatch-->>VoiceButton: matched="Student B", confidence=0.95
    
    Note over VoiceButton: confidence > 0.8 ✓
    
    VoiceButton->>TableStore: updateCell("row2", "value", 95)
    TableStore->>TableStore: Update cellData array
    TableStore->>TableStore: Set lastUpdatedCell={row2, value}
    
    VoiceButton->>UIStore: confirmEntry()
    UIStore->>UIStore: Set recordingState='committing'
    
    DataTableCell->>TableStore: Read cellData
    DataTableCell->>TableStore: Read lastUpdatedCell
    DataTableCell->>UIStore: Read recordingState
    
    Note over DataTableCell: isActive + committing = checkmark
    Note over DataTableCell: isJustUpdated = green flash
    
    DataTableCell-->>User: Shows ✓ + green flash
    
    Note over UIStore: After 500ms
    UIStore->>UIStore: Reset to 'idle'
    
    Note over TableStore: After 1000ms
    TableStore->>TableStore: Clear lastUpdatedCell
```

## Low-Confidence Match Flow (≤0.8)

```mermaid
sequenceDiagram
    participant User
    participant VoiceButton
    participant API as /api/voice-entry
    participant FuzzyMatch
    participant UIStore as useUIStore
    participant ConfirmDialog as ConfirmationDialog
    participant TableStore as useTableDataStore

    User->>VoiceButton: Speaks "Studnt B 95" (typo)
    VoiceButton->>API: POST audio + schema
    API-->>VoiceButton: ParsedResult (entity, value)
    VoiceButton->>FuzzyMatch: Match "Studnt B" against rows
    FuzzyMatch-->>VoiceButton: matched="Student B", confidence=0.65
    
    Note over VoiceButton: confidence ≤ 0.8
    
    VoiceButton->>UIStore: setPendingConfirmation({...})
    VoiceButton->>UIStore: setRecordingState('confirming')
    
    ConfirmDialog->>UIStore: Read pendingConfirmation
    ConfirmDialog-->>User: Show dialog with alternatives
    
    User->>ConfirmDialog: Confirms selection
    ConfirmDialog->>TableStore: updateCell(rowId, columnId, value)
    ConfirmDialog->>UIStore: confirmEntry()
    
    Note over User: Same success animation as high-confidence
```

## Store Structure

```typescript
// useTableDataStore
{
  cellData: [
    { rowId: 'row1', columnId: 'value', value: 95 },
    { rowId: 'row2', columnId: 'value', value: 87 },
    // ...
  ],
  lastUpdatedCell: { rowId: 'row2', columnId: 'value' },
  
  // Actions
  updateCell(rowId, columnId, value) { ... },
  setCellData(data) { ... },
  getCellValue(rowId, columnId) { ... },
  clearLastUpdated() { ... }
}

// useUIStore
{
  activeCell: { rowId: 'row2', columnId: 'value' },
  recordingState: 'committing', // idle | listening | processing | confirming | committing | error
  pendingConfirmation: {
    entity: 'Student B',
    value: 95,
    confidence: 0.65,
    alternatives: [...]
  },
  
  // Actions
  confirmEntry() { ... },
  setRecordingState(state) { ... },
  setPendingConfirmation(data) { ... }
}
```

## Visual States

### Cell Appearance by State

| State | Visual | CSS Classes |
|-------|--------|-------------|
| **Idle** | Normal | `text-gray-900` |
| **Active** | Blue border + corner | `ring-2 ring-blue-500` + blue triangle |
| **Listening** | Blue + pulse | `bg-blue-100 animate-pulse` |
| **Processing** | Yellow | `bg-yellow-50` |
| **Confirming** | Orange | `bg-orange-50` |
| **Committing** | Green + checkmark | `bg-green-500/20` + ✓ |
| **Just Updated** | Green flash | `animate-[flash_0.5s]` + `animate-[fadeOut_1s]` |

### Animation Layers (Z-index)
1. Base background (z-0)
2. State-specific background (z-0)
3. Green flash overlay (z-1, pointer-events-none)
4. Cell value text (z-10)
5. Blue corner indicator (absolute, top-right)
6. Checkmark overlay (absolute, inset-0, when committing)
