📊 Complete Cell Update Flow
Phase 1: User Interaction (Frontend - DataTableCell.tsx)
Step 1: Double-Click to Enter Edit Mode

DataTableCell.tsx
Lines 58-61
const handleDoubleClick = () => {
  setIsEditing(true);
  setEditedValue(value?.toString() || '');
};
What happens:

User double-clicks a cell (or presses Enter when active)
Component switches from <span> to <input> display
Input is auto-focused and text is selected
Local state isEditing: true and editedValue is set to current value
Step 2: User Types New Value

DataTableCell.tsx
Lines 134-143
{isEditing ? (
  <input
    ref={inputRef}
    type="text"
    value={editedValue}
    onChange={(e) => setEditedValue(e.target.value)}
    onBlur={handleSave}
    onKeyDown={handleKeyDown}
    className="w-full bg-transparent border-none outline-none focus:ring-0 p-0 text-sm text-gray-900 dark:text-gray-100"
  />
What happens:

User types new value (e.g., "95")
editedValue state updates with each keystroke
Changes are local only - not saved yet
Step 3: User Saves (Enter or Blur)

DataTableCell.tsx
Lines 78-89
// Save on blur or Enter
const handleSave = async () => {
  setIsEditing(false);
  
  if (editedValue !== value?.toString()) {
    await useTableCellStore.getState().updateCell(
      tableId,
      rowKey,
      tableColumnId,
      editedValue
    );
  }
};
What happens:

User presses Enter or clicks outside (blur)
Exit edit mode: setIsEditing(false)
If value changed, call the store's updateCell function
Phase 2: Optimistic Update (Frontend - Store)
Step 4: Save Previous State for Rollback

table-cell-store.ts
Lines 79-80
// 1. SAVE THE PREVIOUS STATE (for rollback)
const previousCellData = [...get().cellData];
Critical for error handling! If the API fails, we can restore this.

Step 5: Immediately Update Local State (Optimistic)

table-cell-store.ts
Lines 82-109
// 2. OPTIMISTIC UPDATE: Update local state immediately
set((state) => {
  const existingIndex = state.cellData.findIndex(
    (cell) => cell.rowKey === rowKey && cell.tableColumnId === tableColumnId
  );
  
  let newCellData: CellData[];
  
  if (existingIndex >= 0) {
    // Update existing cell
    newCellData = [...state.cellData];
    newCellData[existingIndex] = {
      ...newCellData[existingIndex],
      value,
    };
  } else {
    // Add new cell
    newCellData = [
      ...state.cellData,
      { rowKey, tableColumnId, value },
    ];
  }
  
  return {
    cellData: newCellData,
    lastUpdatedCell: { rowKey, tableColumnId },
  };
});
What happens:

🚀 Instant UI update - user sees new value immediately (no waiting!)
Updates the cellData array in the store
Sets lastUpdatedCell to trigger green flash animation
Any component subscribed to this cell automatically re-renders
Phase 3: API Call (Frontend → Backend)
Step 6: Send PATCH Request

table-cell-store.ts
Lines 112-124
// 3. SEND API REQUEST
try {
  const response = await fetch(`/api/tables/${tableId}/cells`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rowKey,
      tableColumnId,
      value,
      // entrySource: 'MANUAL',  // Optional: specify how this was entered
    }),
  });
What happens:

Sends HTTP PATCH to /api/tables/[tableId]/cells
Includes: rowKey, tableColumnId, value
User already sees the new value (optimistic update)
Request happens in background
Phase 4: API Route Handler (Backend)
Step 7: Validate Request

route.ts
Lines 38-49
// Extract and validate table ID from URL params
const { id: tableId } = await params;
const parsedTableId = uuidSchema.safeParse(tableId);
if (!parsedTableId.success) {
  return apiError(`Invalid table ID format: ${tableId}`, 400);
}
// Parse and validate request body
const bodyResult = await parseBody(req, patchCellSchema);
if (!bodyResult.success) {
  return bodyResult.errorResponse;
}
const { rowKey, tableColumnId, value, entityId, entrySource } = bodyResult.data;
What happens:

Validates table ID is a valid UUID
Validates request body against Zod schema
Extracts the data
Step 8: Call Service Layer

route.ts
Lines 51-60
// Upsert the cell
try {
  const cell = await upsertCell({
    tableId: parsedTableId.data,
    rowKey,
    tableColumnId,
    value,
    entityId,
    entrySource,
  });
  return apiSuccess(cell, 200);
What happens:

Calls upsertCell service function
Returns success response with updated cell data
Phase 5: Database Update (Backend - Prisma)
Step 9: Validate Relationships

cells.ts
Lines 93-127
// Validate that the table exists
const table = await prisma.table.findUnique({
  where: { id: tableId },
  select: { id: true },
});
if (!table) {
  throw new Error(`Table with ID ${tableId} not found`);
}
// Validate that the column exists and belongs to this table
const column = await prisma.tableColumn.findUnique({
  where: { id: tableColumnId },
  select: { id: true, tableId: true },
});
if (!column) {
  throw new Error(`Column with ID ${tableColumnId} not found`);
}
if (column.tableId !== tableId) {
  throw new Error(`Column ${tableColumnId} does not belong to table ${tableId}`);
}
// Validate entityId if provided
if (entityId) {
  const entity = await prisma.listEntity.findUnique({
    where: { id: entityId },
    select: { id: true },
  });
  if (!entity) {
    throw new Error(`Entity with ID ${entityId} not found`);
  }
}
What happens:

Checks table exists
Checks column exists and belongs to this table
Checks entity exists (if provided)
Data integrity protection!
Step 10: Upsert to Database

cells.ts
Lines 129-151
// Perform the upsert
const cell = await prisma.tableCell.upsert({
  where: {
    tableId_rowKey_tableColumnId: {
      tableId,
      rowKey,
      tableColumnId,
    },
  },
  update: {
    value: { value },
    entrySource,
    updatedAt: new Date(),
  },
  create: {
    tableId,
    rowKey,
    tableColumnId,
    entityId,
    value: { value },
    entrySource,
  },
});
What happens:

Uses Prisma's upsert (update or insert)
Unique constraint: (tableId, rowKey, tableColumnId)
If cell exists: UPDATE the value
If cell doesn't exist: CREATE new row
Stores value in JSON format: { value: "95" }
Updates updatedAt timestamp
💾 Data is now persisted in PostgreSQL!
Phase 6: Success Response & UI Feedback
Step 11: API Returns Success

table-cell-store.ts
Lines 130-133
// Success! The optimistic update was correct
// Optionally, you could update with the server response
const result = await response.json();
console.log('Cell updated successfully:', result);
What happens:

API returns 200 OK with cell data
Frontend logs success
Optimistic update was correct - no changes needed!
Step 12: Show Success Animation

table-cell-store.ts
Lines 150-153
// 5. CLEAR SUCCESS INDICATOR after animation
setTimeout(() => {
  get().clearLastUpdated();
}, 1000);
What happens:

lastUpdatedCell stays set for 1 second
Cell shows green flash animation (from CSS)
After 1 second, clear the marker
User gets visual feedback that save was successful
Phase 7: Error Handling (If API Fails)
Step 13: Rollback on Error

table-cell-store.ts
Lines 135-148
} catch (error) {
  // 4. ROLLBACK: If the API fails, restore previous state
  console.error('Error updating cell:', error);
  
  set({
    cellData: previousCellData,
    error: error instanceof Error ? error.message : 'Failed to update cell',
  });
  
  // Optionally show a toast notification to the user
  // toast.error('Failed to update cell. Please try again.');
  
  return; // Exit early, don't clear lastUpdatedCell
}
What happens if API fails:

⏮️ Rollback: Restore previousCellData
User sees old value again
Error message stored in state
Could show toast notification
No green flash (update failed)
🎯 Visual Timeline
User Action              Frontend                 Backend                Database
─────────────────────────────────────────────────────────────────────────────
Double-click cell    →  Enter edit mode
Type "95"            →  Update editedValue
Press Enter          →  Exit edit mode
                     →  
                     →  [Step 4] Save previous state
                     →  [Step 5] Optimistic update
                     →  ✅ User sees "95" instantly!
                     →  [Step 6] Send PATCH request  →
                                                      →  [Step 7] Validate request
                                                      →  [Step 8] Call upsertCell()
                                                                    →  [Step 9] Validate relationships
                                                                    →  [Step 10] UPSERT TableCell
                                                                    →  💾 Saved in DB!
                                                      ←  Return 200 OK
                     ←  [Step 11] Receive success
                     →  [Step 12] Green flash! ✨
                     →  Wait 1 second
                     →  Clear animation
                     →  Done!
🔑 Key Architectural Decisions
1. Optimistic Updates
Why: Instant feedback - no loading spinners!
Trade-off: Must handle rollback if API fails
2. Zustand Store as Single Source of Truth
Why: All components see the same data
Benefit: When one cell updates, all views update automatically
3. Upsert Pattern
Why: Don't need to check if cell exists
Benefit: Simpler code, fewer race conditions
4. Validation at Multiple Layers
Frontend: TypeScript types
API: Zod schemas
Database: Foreign keys + unique constraints
Why: Defense in depth!
5. JSON Storage for Cell Values
Database: value: { "value": "95" }
Why: Flexible schema - supports strings, numbers, booleans, null
This flow demonstrates a production-ready architecture with proper error handling, optimistic updates, and excellent UX! The user never waits for the server - they see changes instantly, with automatic rollback if something goes wrong.

