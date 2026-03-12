# Smart Pointer Auto-Advance - Visual Flow

## Column-First Mode (Default)

```
┌─────────────┬─────────┬─────────┬─────────┐
│ Student     │ Quiz 1  │ Quiz 2  │ Quiz 3  │
├─────────────┼─────────┼─────────┼─────────┤
│ John Smith  │  [1] ← Start here
│ Sarah Jones │  [2] ← Auto-advance (down)
│ Mike Brown  │  [3] ← Auto-advance (down)
│ Jane Doe    │  [4] ← Auto-advance (down)
│ Tom Wilson  │  [5] ← Auto-advance (down)
└─────────────┴─────────┴─────────┴─────────┘
                  ↓ (After last row, wrap to next column)
┌─────────────┬─────────┬─────────┬─────────┐
│ Student     │ Quiz 1  │ Quiz 2  │ Quiz 3  │
├─────────────┼─────────┼─────────┼─────────┤
│ John Smith  │   85    │  [6] ← Wrap to first row, next column
│ Sarah Jones │   90    │  [7] ← Continue down
│ Mike Brown  │   88    │  [8] ← Continue down
│ Jane Doe    │   92    │  [9] ← Continue down
│ Tom Wilson  │   87    │  [10]← Continue down
└─────────────┴─────────┴─────────┴─────────┘
```

**Pattern**: Fill one column completely before moving to the next column.

**Use Case**: Entering the same type of data for all students (e.g., all Quiz 1 scores).

---

## Row-First Mode

```
┌─────────────┬─────────┬─────────┬─────────┐
│ Student     │ Quiz 1  │ Quiz 2  │ Quiz 3  │
├─────────────┼─────────┼─────────┼─────────┤
│ John Smith  │  [1] ← Start     [2]→    [3]→    [4]→ Auto-advance (right)
│ Sarah Jones │  
│ Mike Brown  │  
└─────────────┴─────────┴─────────┴─────────┘
                                              ↓ (After last column, wrap to next row)
┌─────────────┬─────────┬─────────┬─────────┐
│ Student     │ Quiz 1  │ Quiz 2  │ Quiz 3  │
├─────────────┼─────────┼─────────┼─────────┤
│ John Smith  │   85    │   90    │   88    │   92 (complete)
│ Sarah Jones │  [5] ← Wrap to first column, next row
│ Mike Brown  │  
└─────────────┴─────────┴─────────┴─────────┘
```

**Pattern**: Fill one row completely before moving to the next row.

**Use Case**: Entering all data for one student before moving to the next student.

---

## Implementation Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    VOICE INPUT RECEIVED                      │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  Transcribe & Parse           │
         │  (OpenAI Whisper + GPT-4)     │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  Fuzzy Match Entity           │
         │  (Fuse.js)                    │
         └───────────────┬───────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Confidence > 0.8?    │
              └──────────┬───────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
           YES                       NO
            │                         │
            ▼                         ▼
   ┌────────────────────┐    ┌────────────────────┐
   │ AUTO-CONFIRM       │    │ SHOW CONFIRMATION  │
   │                    │    │ DIALOG             │
   │ 1. updateCell()    │    │                    │
   │ 2. confirmEntry()  │    │ (Manual confirm)   │
   │    → Green Flash   │    └────────────────────┘
   │ 3. calculateNext() │
   │ 4. setTimeout()    │
   │ 5. setActiveCell() │
   │    → Advance!      │
   └────────────────────┘
            │
            ▼
   ┌────────────────────┐
   │ Ready for next     │
   │ voice input        │
   └────────────────────┘
```

---

## Code Locations

### Navigation Logic
- **Column-First**: `lib/navigation/column-first.ts`
  - `getNextCellColumnFirst(currentCell, schema): ActiveCell | null`
  - `getPreviousCellColumnFirst(currentCell, schema): ActiveCell | null`

- **Row-First**: `lib/navigation/row-first.ts`
  - `getNextCellRowFirst(currentCell, schema): ActiveCell | null`
  - `getPreviousCellRowFirst(currentCell, schema): ActiveCell | null`

### Integration Point
- **VoiceButton**: `components/voice/VoiceButton.tsx`
  - Lines 44-51: `calculateNextCell()` helper function
  - Lines 223-236: Pointer advancement logic

### State Management
- **UIStore**: `lib/stores/ui-store.ts`
  - `activeCell: CellPosition | null` - Current pointer position
  - `navigationMode: 'column-first' | 'row-first'` - Current mode
  - `setActiveCell(cell)` - Update pointer position

---

## Timing Details

| Event | Timing | Purpose |
|-------|--------|---------|
| Cell Update | Immediate | Write data to TableDataStore |
| Green Flash Start | Immediate | Visual feedback (confirmEntry()) |
| Green Flash Duration | 500ms | UIStore timeout (see ui-store.ts:118) |
| Pointer Advance Delay | 500ms | Allow animation to be visible |
| Total Success Cycle | ~1000ms | From update to pointer advance |

---

## Edge Cases

### 1. End of Table (Column-First)
```
Last cell: (Student E, Quiz 3)
Next calculation: null
Behavior: Pointer stays at (Student E, Quiz 3)
Console: "Reached end of table - pointer will not advance"
```

### 2. End of Table (Row-First)
```
Last cell: (Student E, Quiz 3)
Next calculation: null
Behavior: Pointer stays at (Student E, Quiz 3)
Console: "Reached end of table - pointer will not advance"
```

### 3. Invalid Current Cell
```
Current cell not in schema
Next calculation: null (with console error)
Behavior: Pointer doesn't advance
```

---

## Testing Checklist

- [ ] Column-First: Advances down within column
- [ ] Column-First: Wraps to next column at end of current column
- [ ] Column-First: Stops at end of table
- [ ] Row-First: Advances right within row
- [ ] Row-First: Wraps to next row at end of current row
- [ ] Row-First: Stops at end of table
- [ ] Green flash animation visible before pointer moves
- [ ] Console logs show advancement or end-of-table messages
- [ ] Low confidence (< 0.8) doesn't auto-advance
- [ ] Mode switching works correctly

---

## Future Enhancements

1. **Manual Confirmation Path**: Add pointer advancement after user confirms low-confidence entries
2. **Skip Filled Cells**: Option to automatically skip cells that already have values
3. **Keyboard Navigation**: Arrow keys, Tab, Enter for manual pointer control
4. **Pointer History**: Undo/redo functionality
5. **Visual Transition**: Smooth animation when pointer advances
6. **Audio Feedback**: Optional sound effect when pointer advances
