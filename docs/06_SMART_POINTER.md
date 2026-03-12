# VocalGrid - Smart Pointer System

**Chapter:** 06  
**Dependencies:** 04_STATE_MANAGEMENT.md, 05_VOICE_PIPELINE.md  
**Related:** 08_UI_COMPONENTS.md

---

## Table of Contents

1. [Smart Pointer Concept](#1-smart-pointer-concept)
   - 1.1 [What is the Smart Pointer?](#11-what-is-the-smart-pointer)
   - 1.2 [Visual Representation](#12-visual-representation)

2. [State Machine](#2-state-machine)
   - 2.1 [Pointer States](#21-pointer-states)
   - 2.2 [State Transitions](#22-state-transitions)

3. [Navigation Modes](#3-navigation-modes)
   - 3.1 [Column-First Mode](#31-column-first-mode)
   - 3.2 [Row-First Mode](#32-row-first-mode)
   - 3.3 [Unified Navigation Hook](#33-unified-navigation-hook)

4. [Keyboard Navigation](#4-keyboard-navigation)
   - 4.1 [Keyboard Shortcuts](#41-keyboard-shortcuts)
   - 4.2 [Keyboard Shortcuts Reference](#42-keyboard-shortcuts-reference)

5. [Visual Feedback](#5-visual-feedback)
   - 5.1 [Cell Highlighting](#51-cell-highlighting)
   - 5.2 [Success Animation](#52-success-animation)
   - 5.3 [Mode Indicator](#53-mode-indicator)

6. [Edge Cases](#6-edge-cases)
   - 6.1 [Empty Table](#61-empty-table)
   - 6.2 [End of Table Behavior](#62-end-of-table-behavior)
   - 6.3 [Skip Filled Cells (Optional Feature)](#63-skip-filled-cells-optional-feature)

7. [Pointer Persistence](#7-pointer-persistence)
   - 7.1 [Save Pointer Position](#71-save-pointer-position)
   - 7.2 [Restore on Page Load](#72-restore-on-page-load)

8. [Testing](#8-testing)
   - 8.1 [Navigation Tests](#81-navigation-tests)

9. [Continuous Flow Integration](#9-continuous-flow-integration)
   - 9.1 [The Core Problem with the Current State Machine](#91-the-core-problem-with-the-current-state-machine)
   - 9.2 [Updated State Transition Diagram](#92-updated-state-transition-diagram)
   - 9.3 [Updated State Machine Implementation](#93-updated-state-machine-implementation)
   - 9.4 [Navigation Hook — Continuous Mode Extension](#94-navigation-hook-continuous-mode-extension)
   - 9.5 [Continuous Mode UI Controls](#95-continuous-mode-ui-controls)
   - 9.6 [Continuous Flow — Full Sequence Diagram](#96-continuous-flow-full-sequence-diagram)
   - 9.7 [Continuous Flow Checklist](#97-continuous-flow-checklist)

10. [Smart Pointer Checklist](#10-smart-pointer-checklist)

---

## 1. Smart Pointer Concept

### 1.1 What is the Smart Pointer?

The **Smart Pointer** is a context-aware cursor that:
- Tracks the currently active cell in the table
- Understands navigation intent (row-first vs column-first)
- Automatically advances to the next logical cell
- Provides visual feedback to the user
- Handles edge cases (end of table, wrapping)

### 1.2 Visual Representation
```
Column-First Mode (filling Quiz 1 for all students):

┌─────────────┬─────────┬─────────┬─────────┐
│ Student     │ Quiz 1  │ Quiz 2  │ Quiz 3  │
├─────────────┼─────────┼─────────┼─────────┤
│ John Smith  │ [→85]   │         │         │ ← Pointer here (blue highlight)
│ Sarah Jones │         │         │         │ ← Next (will advance here)
│ Mike Brown  │         │         │         │
└─────────────┴─────────┴─────────┴─────────┘

After voice input "85":
1. Cell flashes green (success)
2. Pointer moves down to (Sarah Jones, Quiz 1)
3. Ready for next input


Row-First Mode (filling all quizzes for John):

┌─────────────┬─────────┬─────────┬─────────┐
│ Student     │ Quiz 1  │ Quiz 2  │ Quiz 3  │
├─────────────┼─────────┼─────────┼─────────┤
│ John Smith  │ 85      │ [→90]   │         │ ← Pointer here
│ Sarah Jones │         │         │         │
│ Mike Brown  │         │         │         │
└─────────────┴─────────┴─────────┴─────────┘

After voice input "90":
1. Cell flashes green
2. Pointer moves right to (John Smith, Quiz 3)
3. Ready for next input
```

---

## 2. State Machine

### 2.1 Pointer States
```
┌─────────────────────────────────────────────────────────────┐
│                  SMART POINTER STATES                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. IDLE                                                    │
│     - Pointer at a specific cell (highlighted)              │
│     - Waiting for user input                                │
│     - User can:                                             │
│       • Click a cell to move pointer                        │
│       • Start voice input                                   │
│       • Use keyboard arrows to navigate                     │
│                                                             │
│  2. LISTENING                                               │
│     - Pointer locked (cannot move)                          │
│     - Recording audio                                       │
│     - Visual: Pulsing animation                             │
│                                                             │
│  3. PROCESSING                                              │
│     - Pointer locked                                        │
│     - Transcribing + parsing                                │
│     - Visual: Loading spinner                               │
│                                                             │
│  4. CONFIRMING                                              │
│     - Pointer locked                                        │
│     - Showing parsed result                                 │
│     - Visual: Preview overlay on target cell                │
│     - Waiting for confirmation                              │
│                                                             │
│  5. COMMITTING                                              │
│     - Writing to database                                   │
│     - Visual: Green flash animation                         │
│                                                             │
│  6. ADVANCING                                               │
│     - Moving pointer to next cell                           │
│     - Based on navigation mode                              │
│     - Visual: Smooth transition animation                   │
│     - Returns to IDLE                                       │
│                                                             │
│  7. ERROR                                                   │
│     - Something went wrong                                  │
│     - Visual: Red flash on current cell                     │
│     - Returns to IDLE after 2 seconds                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 State Transitions
```typescript
// lib/state-machines/pointer-state.ts

export type PointerState = 
  | 'idle'
  | 'listening'
  | 'processing'
  | 'confirming'
  | 'committing'
  | 'advancing'
  | 'error';

export type PointerEvent =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'TRANSCRIPTION_COMPLETE' }
  | { type: 'PARSE_COMPLETE' }
  | { type: 'USER_CONFIRMED' }
  | { type: 'USER_CANCELLED' }
  | { type: 'COMMIT_SUCCESS' }
  | { type: 'COMMIT_FAILED' }
  | { type: 'ADVANCE_COMPLETE' }
  | { type: 'ERROR'; error: string };

export function pointerReducer(
  state: PointerState,
  event: PointerEvent
): PointerState {
  switch (state) {
    case 'idle':
      if (event.type === 'START_RECORDING') return 'listening';
      break;
      
    case 'listening':
      if (event.type === 'STOP_RECORDING') return 'processing';
      if (event.type === 'ERROR') return 'error';
      break;
      
    case 'processing':
      if (event.type === 'PARSE_COMPLETE') return 'confirming';
      if (event.type === 'ERROR') return 'error';
      break;
      
    case 'confirming':
      if (event.type === 'USER_CONFIRMED') return 'committing';
      if (event.type === 'USER_CANCELLED') return 'idle';
      break;
      
    case 'committing':
      if (event.type === 'COMMIT_SUCCESS') return 'advancing';
      if (event.type === 'COMMIT_FAILED') return 'error';
      break;
      
    case 'advancing':
      if (event.type === 'ADVANCE_COMPLETE') return 'idle';
      break;
      
    case 'error':
      // Auto-return to idle after timeout (handled in component)
      break;
  }
  
  return state;
}
```

---

## 3. Navigation Modes

### 3.1 Column-First Mode
```typescript
// lib/navigation/column-first.ts

import { TableSchema } from '@/types/schema';

interface ActiveCell {
  rowId: string;
  columnId: string;
}

/**
 * Column-First Navigation
 * 
 * Pattern: Fill one column across all rows, then move to next column
 * 
 * Example:
 * Start: (row0, col0)
 * Next:  (row1, col0)
 * Next:  (row2, col0)
 * ...
 * Next:  (rowN, col0) → end of column
 * Next:  (row0, col1) → wrap to next column
 */
export function getNextCellColumnFirst(
  currentCell: ActiveCell,
  schema: TableSchema
): ActiveCell | null {
  const { rowId, columnId } = currentCell;
  
  // Find current indices
  const currentRowIndex = schema.rows.findIndex((r) => r.id === rowId);
  const currentColIndex = schema.columns.findIndex((c) => c.id === columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    console.error('Current cell not found in schema');
    return null;
  }
  
  // Try to move down (next row, same column)
  const nextRowIndex = currentRowIndex + 1;
  
  if (nextRowIndex < schema.rows.length) {
    // Move to next row
    return {
      rowId: schema.rows[nextRowIndex].id,
      columnId: columnId,
    };
  }
  
  // End of column, try to move to next column
  const nextColIndex = currentColIndex + 1;
  
  if (nextColIndex < schema.columns.length) {
    // Move to first row of next column
    return {
      rowId: schema.rows[0].id,
      columnId: schema.columns[nextColIndex].id,
    };
  }
  
  // End of table
  return null;
}

/**
 * Get previous cell (for undo/backspace)
 */
export function getPreviousCellColumnFirst(
  currentCell: ActiveCell,
  schema: TableSchema
): ActiveCell | null {
  const { rowId, columnId } = currentCell;
  
  const currentRowIndex = schema.rows.findIndex((r) => r.id === rowId);
  const currentColIndex = schema.columns.findIndex((c) => c.id === columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    return null;
  }
  
  // Try to move up (previous row, same column)
  const prevRowIndex = currentRowIndex - 1;
  
  if (prevRowIndex >= 0) {
    return {
      rowId: schema.rows[prevRowIndex].id,
      columnId: columnId,
    };
  }
  
  // Beginning of column, try to move to previous column
  const prevColIndex = currentColIndex - 1;
  
  if (prevColIndex >= 0) {
    // Move to last row of previous column
    return {
      rowId: schema.rows[schema.rows.length - 1].id,
      columnId: schema.columns[prevColIndex].id,
    };
  }
  
  // Beginning of table
  return null;
}
```

### 3.2 Row-First Mode
```typescript
// lib/navigation/row-first.ts

import { TableSchema } from '@/types/schema';

interface ActiveCell {
  rowId: string;
  columnId: string;
}

/**
 * Row-First Navigation
 * 
 * Pattern: Fill one row across all columns, then move to next row
 * 
 * Example:
 * Start: (row0, col0)
 * Next:  (row0, col1)
 * Next:  (row0, col2)
 * ...
 * Next:  (row0, colN) → end of row
 * Next:  (row1, col0) → wrap to next row
 */
export function getNextCellRowFirst(
  currentCell: ActiveCell,
  schema: TableSchema
): ActiveCell | null {
  const { rowId, columnId } = currentCell;
  
  const currentRowIndex = schema.rows.findIndex((r) => r.id === rowId);
  const currentColIndex = schema.columns.findIndex((c) => c.id === columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    console.error('Current cell not found in schema');
    return null;
  }
  
  // Try to move right (same row, next column)
  const nextColIndex = currentColIndex + 1;
  
  if (nextColIndex < schema.columns.length) {
    // Move to next column
    return {
      rowId: rowId,
      columnId: schema.columns[nextColIndex].id,
    };
  }
  
  // End of row, try to move to next row
  const nextRowIndex = currentRowIndex + 1;
  
  if (nextRowIndex < schema.rows.length) {
    // Move to first column of next row
    return {
      rowId: schema.rows[nextRowIndex].id,
      columnId: schema.columns[0].id,
    };
  }
  
  // End of table
  return null;
}

/**
 * Get previous cell
 */
export function getPreviousCellRowFirst(
  currentCell: ActiveCell,
  schema: TableSchema
): ActiveCell | null {
  const { rowId, columnId } = currentCell;
  
  const currentRowIndex = schema.rows.findIndex((r) => r.id === rowId);
  const currentColIndex = schema.columns.findIndex((c) => c.id === columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    return null;
  }
  
  // Try to move left (same row, previous column)
  const prevColIndex = currentColIndex - 1;
  
  if (prevColIndex >= 0) {
    return {
      rowId: rowId,
      columnId: schema.columns[prevColIndex].id,
    };
  }
  
  // Beginning of row, try to move to previous row
  const prevRowIndex = currentRowIndex - 1;
  
  if (prevRowIndex >= 0) {
    // Move to last column of previous row
    return {
      rowId: schema.rows[prevRowIndex].id,
      columnId: schema.columns[schema.columns.length - 1].id,
    };
  }
  
  // Beginning of table
  return null;
}
```

### 3.3 Unified Navigation Hook
```typescript
// lib/hooks/use-pointer-navigation.ts

import { useUIStore } from '@/lib/stores/ui-store';
import { TableSchema } from '@/types/schema';
import { getNextCellColumnFirst, getPreviousCellColumnFirst } from '@/lib/navigation/column-first';
import { getNextCellRowFirst, getPreviousCellRowFirst } from '@/lib/navigation/row-first';

export function usePointerNavigation(schema: TableSchema) {
  const activeCell = useUIStore((state) => state.activeCell);
  const navigationMode = useUIStore((state) => state.navigationMode);
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  
  const advancePointer = () => {
    if (!activeCell) return;
    
    const nextCell = navigationMode === 'column-first'
      ? getNextCellColumnFirst(activeCell, schema)
      : getNextCellRowFirst(activeCell, schema);
    
    if (nextCell) {
      setActiveCell(nextCell);
    } else {
      // End of table
      console.log('Reached end of table');
      // Optional: Show toast, play sound, etc.
    }
  };
  
  const retreatPointer = () => {
    if (!activeCell) return;
    
    const prevCell = navigationMode === 'column-first'
      ? getPreviousCellColumnFirst(activeCell, schema)
      : getPreviousCellRowFirst(activeCell, schema);
    
    if (prevCell) {
      setActiveCell(prevCell);
    } else {
      // Beginning of table
      console.log('At beginning of table');
    }
  };
  
  const movePointerUp = () => {
    if (!activeCell) return;
    
    const currentRowIndex = schema.rows.findIndex((r) => r.id === activeCell.rowId);
    if (currentRowIndex > 0) {
      setActiveCell({
        rowId: schema.rows[currentRowIndex - 1].id,
        columnId: activeCell.columnId,
      });
    }
  };
  
  const movePointerDown = () => {
    if (!activeCell) return;
    
    const currentRowIndex = schema.rows.findIndex((r) => r.id === activeCell.rowId);
    if (currentRowIndex < schema.rows.length - 1) {
      setActiveCell({
        rowId: schema.rows[currentRowIndex + 1].id,
        columnId: activeCell.columnId,
      });
    }
  };
  
  const movePointerLeft = () => {
    if (!activeCell) return;
    
    const currentColIndex = schema.columns.findIndex((c) => c.id === activeCell.columnId);
    if (currentColIndex > 0) {
      setActiveCell({
        rowId: activeCell.rowId,
        columnId: schema.columns[currentColIndex - 1].id,
      });
    }
  };
  
  const movePointerRight = () => {
    if (!activeCell) return;
    
    const currentColIndex = schema.columns.findIndex((c) => c.id === activeCell.columnId);
    if (currentColIndex < schema.columns.length - 1) {
      setActiveCell({
        rowId: activeCell.rowId,
        columnId: schema.columns[currentColIndex + 1].id,
      });
    }
  };
  
  return {
    advancePointer,
    retreatPointer,
    movePointerUp,
    movePointerDown,
    movePointerLeft,
    movePointerRight,
  };
}
```

---

## 4. Keyboard Navigation

### 4.1 Keyboard Shortcuts
```typescript
// lib/hooks/use-keyboard-navigation.ts

import { useEffect } from 'react';
import { usePointerNavigation } from './use-pointer-navigation';
import { useUIStore } from '@/lib/stores/ui-store';
import { TableSchema } from '@/types/schema';

export function useKeyboardNavigation(schema: TableSchema) {
  const {
    advancePointer,
    retreatPointer,
    movePointerUp,
    movePointerDown,
    movePointerLeft,
    movePointerRight,
  } = usePointerNavigation(schema);
  
  const navigationMode = useUIStore((state) => state.navigationMode);
  const setNavigationMode = useUIStore((state) => state.setNavigationMode);
  const isRecording = useUIStore((state) => state.isRecording);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if recording or typing in input
      if (isRecording) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Prevent default for navigation keys
      const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
      if (navKeys.includes(event.key)) {
        event.preventDefault();
      }
      
      switch (event.key) {
        case 'ArrowUp':
          movePointerUp();
          break;
          
        case 'ArrowDown':
          movePointerDown();
          break;
          
        case 'ArrowLeft':
          movePointerLeft();
          break;
          
        case 'ArrowRight':
          movePointerRight();
          break;
          
        case 'Tab':
          if (event.shiftKey) {
            retreatPointer();
          } else {
            advancePointer();
          }
          break;
          
        case 'Enter':
          advancePointer();
          break;
          
        case 'Backspace':
          retreatPointer();
          break;
          
        // Toggle navigation mode (Ctrl/Cmd + M)
        case 'm':
        case 'M':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setNavigationMode(
              navigationMode === 'column-first' ? 'row-first' : 'column-first'
            );
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isRecording,
    navigationMode,
    advancePointer,
    retreatPointer,
    movePointerUp,
    movePointerDown,
    movePointerLeft,
    movePointerRight,
    setNavigationMode,
  ]);
}
```

### 4.2 Keyboard Shortcuts Reference
```
┌─────────────────────────────────────────────────────────────┐
│               KEYBOARD SHORTCUTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Navigation:                                                │
│  • ↑          Move pointer up                               │
│  • ↓          Move pointer down                             │
│  • ←          Move pointer left                             │
│  • →          Move pointer right                            │
│                                                             │
│  Smart Navigation:                                          │
│  • Tab        Advance pointer (based on mode)               │
│  • Shift+Tab  Retreat pointer (based on mode)               │
│  • Enter      Advance pointer                               │
│  • Backspace  Retreat pointer                               │
│                                                             │
│  Modes:                                                     │
│  • Ctrl/⌘+M   Toggle navigation mode                        │
│                                                             │
│  Voice Input:                                               │
│  • Space      Start/stop recording (hold/release)           │
│  • Esc        Cancel recording                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Visual Feedback

### 5.1 Cell Highlighting
```typescript
// components/TableCell.tsx

import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils';

interface TableCellProps {
  rowId: string;
  columnId: string;
  value: any;
  onClick: () => void;
}

export function TableCell({ rowId, columnId, value, onClick }: TableCellProps) {
  const activeCell = useUIStore((state) => state.activeCell);
  const recordingState = useUIStore((state) => state.recordingState);
  
  const isActive = activeCell?.rowId === rowId && activeCell?.columnId === columnId;
  
  return (
    <td
      onClick={onClick}
      className={cn(
        'border px-4 py-2 cursor-pointer transition-all duration-200',
        
        // Base styles
        'hover:bg-gray-50',
        
        // Active cell highlighting
        isActive && [
          'ring-2 ring-blue-500 ring-inset',
          'bg-blue-50',
          'relative',
          
          // State-specific styles
          recordingState === 'listening' && 'animate-pulse',
          recordingState === 'processing' && 'bg-yellow-50',
          recordingState === 'confirming' && 'bg-orange-50',
          recordingState === 'committing' && 'bg-green-50',
        ]
      )}
    >
      {/* Value */}
      <span className="relative z-10">{value}</span>
      
      {/* Active indicator (corner badge) */}
      {isActive && (
        <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-bl" />
      )}
    </td>
  );
}
```

### 5.2 Success Animation
```typescript
// components/CellSuccessAnimation.tsx

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

interface CellSuccessAnimationProps {
  rowId: string;
  columnId: string;
  show: boolean;
}

export function CellSuccessAnimation({
  rowId,
  columnId,
  show,
}: CellSuccessAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [show]);
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center bg-green-500/20 pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.5 }}
          >
            <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Usage in TableCell:
import { CellSuccessAnimation } from './CellSuccessAnimation';

export function TableCell({ rowId, columnId, value }: TableCellProps) {
  const recordingState = useUIStore((state) => state.recordingState);
  
  return (
    <td className="relative">
      {value}
      <CellSuccessAnimation
        rowId={rowId}
        columnId={columnId}
        show={recordingState === 'committing'}
      />
    </td>
  );
}
```

### 5.3 Mode Indicator
```typescript
// components/NavigationModeIndicator.tsx

import { useUIStore } from '@/lib/stores/ui-store';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NavigationModeIndicator() {
  const navigationMode = useUIStore((state) => state.navigationMode);
  const setNavigationMode = useUIStore((state) => state.setNavigationMode);
  
  const toggleMode = () => {
    setNavigationMode(
      navigationMode === 'column-first' ? 'row-first' : 'column-first'
    );
  };
  
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
      <span className="text-sm font-medium text-gray-700">Mode:</span>
      
      <Button
        variant={navigationMode === 'column-first' ? 'default' : 'outline'}
        size="sm"
        onClick={toggleMode}
        className="gap-1"
      >
        <ArrowDown className="w-4 h-4" />
        Column-First
      </Button>
      
      <Button
        variant={navigationMode === 'row-first' ? 'default' : 'outline'}
        size="sm"
        onClick={toggleMode}
        className="gap-1"
      >
        <ArrowRight className="w-4 h-4" />
        Row-First
      </Button>
      
      <span className="text-xs text-gray-500 ml-2">
        {navigationMode === 'column-first'
          ? 'Filling down ↓'
          : 'Filling right →'}
      </span>
    </div>
  );
}
```

---

## 6. Edge Cases

### 6.1 Empty Table
```typescript
// lib/navigation/edge-cases.ts

export function handleEmptyTable(schema: TableSchema): {
  canNavigate: boolean;
  message?: string;
} {
  if (schema.rows.length === 0) {
    return {
      canNavigate: false,
      message: 'No rows in table. Add a row to start.',
    };
  }
  
  if (schema.columns.length === 0) {
    return {
      canNavigate: false,
      message: 'No columns in table. Add a column to start.',
    };
  }
  
  return { canNavigate: true };
}
```

### 6.2 End of Table Behavior
```typescript
// lib/navigation/end-of-table.ts

export function handleEndOfTable(
  currentCell: ActiveCell,
  schema: TableSchema,
  mode: 'column-first' | 'row-first'
): {
  atEnd: boolean;
  action: 'stop' | 'wrap' | 'ask';
  nextCell?: ActiveCell;
} {
  const isLastRow = schema.rows[schema.rows.length - 1].id === currentCell.rowId;
  const isLastCol = schema.columns[schema.columns.length - 1].id === currentCell.columnId;
  
  if (mode === 'column-first') {
    if (isLastRow && isLastCol) {
      // Absolute end
      return {
        atEnd: true,
        action: 'stop',
      };
    }
    
    if (isLastRow) {
      // End of column, wrap to next column
      return {
        atEnd: false,
        action: 'wrap',
        nextCell: {
          rowId: schema.rows[0].id,
          columnId: schema.columns[
            schema.columns.findIndex((c) => c.id === currentCell.columnId) + 1
          ].id,
        },
      };
    }
  } else {
    // row-first
    if (isLastRow && isLastCol) {
      return {
        atEnd: true,
        action: 'stop',
      };
    }
    
    if (isLastCol) {
      // End of row, wrap to next row
      return {
        atEnd: false,
        action: 'wrap',
        nextCell: {
          rowId: schema.rows[
            schema.rows.findIndex((r) => r.id === currentCell.rowId) + 1
          ].id,
          columnId: schema.columns[0].id,
        },
      };
    }
  }
  
  return { atEnd: false, action: 'stop' };
}
```

### 6.3 Skip Filled Cells (Optional Feature)
```typescript
// lib/navigation/skip-filled.ts

interface TableData {
  rowId: string;
  columnId: string;
  value: any;
}

export function getNextEmptyCell(
  currentCell: ActiveCell,
  schema: TableSchema,
  data: TableData[],
  mode: 'column-first' | 'row-first'
): ActiveCell | null {
  let nextCell = mode === 'column-first'
    ? getNextCellColumnFirst(currentCell, schema)
    : getNextCellRowFirst(currentCell, schema);
  
  // Keep advancing until we find an empty cell
  const maxIterations = schema.rows.length * schema.columns.length;
  let iterations = 0;
  
  while (nextCell && iterations < maxIterations) {
    const cellData = data.find(
      (d) => d.rowId === nextCell!.rowId && d.columnId === nextCell!.columnId
    );
    
    // If cell is empty, return it
    if (!cellData || cellData.value === null || cellData.value === undefined) {
      return nextCell;
    }
    
    // Otherwise, keep advancing
    nextCell = mode === 'column-first'
      ? getNextCellColumnFirst(nextCell, schema)
      : getNextCellRowFirst(nextCell, schema);
    
    iterations++;
  }
  
  // All cells are filled or we've looped
  return null;
}
```

---

## 7. Pointer Persistence

### 7.1 Save Pointer Position
```typescript
// lib/storage/pointer-storage.ts

interface PointerPosition {
  tableId: string;
  rowId: string;
  columnId: string;
  mode: 'column-first' | 'row-first';
  timestamp: number;
}

export function savePointerPosition(position: PointerPosition) {
  localStorage.setItem(
    `pointer:${position.tableId}`,
    JSON.stringify(position)
  );
}

export function loadPointerPosition(tableId: string): PointerPosition | null {
  const stored = localStorage.getItem(`pointer:${tableId}`);
  if (!stored) return null;
  
  try {
    const position = JSON.parse(stored);
    
    // Expire after 24 hours
    if (Date.now() - position.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(`pointer:${tableId}`);
      return null;
    }
    
    return position;
  } catch {
    return null;
  }
}

export function clearPointerPosition(tableId: string) {
  localStorage.removeItem(`pointer:${tableId}`);
}
```

### 7.2 Restore on Page Load
```typescript
// app/table/[id]/page.tsx

'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { loadPointerPosition } from '@/lib/storage/pointer-storage';

export default function TablePage({ params }: { params: { id: string } }) {
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const setNavigationMode = useUIStore((state) => state.setNavigationMode);
  
  useEffect(() => {
    // Try to restore pointer position
    const saved = loadPointerPosition(params.id);
    
    if (saved) {
      setActiveCell({
        rowId: saved.rowId,
        columnId: saved.columnId,
      });
      setNavigationMode(saved.mode);
    } else {
      // Default to first cell
      setActiveCell({
        rowId: schema.rows[0].id,
        columnId: schema.columns[0].id,
      });
    }
  }, [params.id, setActiveCell, setNavigationMode]);
  
  // Save position on change
  useEffect(() => {
    const activeCell = useUIStore.getState().activeCell;
    const mode = useUIStore.getState().navigationMode;
    
    if (activeCell) {
      savePointerPosition({
        tableId: params.id,
        rowId: activeCell.rowId,
        columnId: activeCell.columnId,
        mode,
        timestamp: Date.now(),
      });
    }
  }, [params.id]);
  
  return <div>{/* Table UI */}</div>;
}
```

---

## 8. Testing

### 8.1 Navigation Tests
```typescript
// tests/navigation.test.ts

import { describe, it, expect } from 'vitest';
import { getNextCellColumnFirst, getNextCellRowFirst } from '@/lib/navigation';

const mockSchema = {
  rows: [
    { id: 'row1', label: 'Row 1' },
    { id: 'row2', label: 'Row 2' },
    { id: 'row3', label: 'Row 3' },
  ],
  columns: [
    { id: 'col1', label: 'Col 1', type: 'text' },
    { id: 'col2', label: 'Col 2', type: 'number' },
  ],
};

describe('Column-First Navigation', () => {
  it('should move down within column', () => {
    const next = getNextCellColumnFirst(
      { rowId: 'row1', columnId: 'col1' },
      mockSchema
    );
    
    expect(next).toEqual({ rowId: 'row2', columnId: 'col1' });
  });
  
  it('should wrap to next column at end of current column', () => {
    const next = getNextCellColumnFirst(
      { rowId: 'row3', columnId: 'col1' },
      mockSchema
    );
    
    expect(next).toEqual({ rowId: 'row1', columnId: 'col2' });
  });
  
  it('should return null at end of table', () => {
    const next = getNextCellColumnFirst(
      { rowId: 'row3', columnId: 'col2' },
      mockSchema
    );
    
    expect(next).toBeNull();
  });
});

describe('Row-First Navigation', () => {
  it('should move right within row', () => {
    const next = getNextCellRowFirst(
      { rowId: 'row1', columnId: 'col1' },
      mockSchema
    );
    
    expect(next).toEqual({ rowId: 'row1', columnId: 'col2' });
  });
  
  it('should wrap to next row at end of current row', () => {
    const next = getNextCellRowFirst(
      { rowId: 'row1', columnId: 'col2' },
      mockSchema
    );
    
    expect(next).toEqual({ rowId: 'row2', columnId: 'col1' });
  });
  
  it('should return null at end of table', () => {
    const next = getNextCellRowFirst(
      { rowId: 'row3', columnId: 'col2' },
      mockSchema
    );
    
    expect(next).toBeNull();
  });
});
```

## 9. Continuous Flow Integration

> **Status:** Planned feature — depends on `05_VOICE_PIPELINE.md §9` (VAD) and `04_STATE_MANAGEMENT.md §9` (store flag).

### 9.1 The Core Problem with the Current State Machine

The existing state machine (`§2.2`) terminates at `advancing → idle` and stops. In Continuous Flow mode, `idle` should not be a resting state — the system must immediately re-enter `listening` after the pointer advances.

The fix is a **single conditional auto-transition** driven by the `continuousMode` flag in the Zustand store. The state machine logic itself does not change; the component that drives it checks the flag after `ADVANCE_COMPLETE` and dispatches `START_RECORDING` automatically.

### 9.2 Updated State Transition Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│           SMART POINTER STATE MACHINE (with Continuous Flow)    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      ┌─────────┐                               │
│           ┌──────────│  IDLE   │◄──────────────────────┐       │
│           │          └────┬────┘                       │       │
│           │               │ START_RECORDING             │       │
│           │               ▼                             │       │
│           │         ┌───────────┐                       │       │
│           │         │ LISTENING │◄─────────────────┐    │       │
│           │         └─────┬─────┘                  │    │       │
│           │               │ STOP_RECORDING          │    │       │
│           │               ▼                         │    │       │
│           │        ┌────────────┐                   │    │       │
│           │        │ PROCESSING │                   │    │       │
│           │        └─────┬──────┘                   │    │       │
│           │               │ PARSE_COMPLETE           │    │       │
│           │               ▼                         │    │       │
│           │        ┌────────────┐                   │    │       │
│           │        │ CONFIRMING │                   │    │       │
│           │        └─────┬──────┘                   │    │       │
│           │    confirmed │ │ cancelled               │    │       │
│           │               │ └────────────────────────┘    │       │
│           │               ▼                               │       │
│           │        ┌────────────┐                         │       │
│           │        │ COMMITTING │                         │       │
│           │        └─────┬──────┘                         │       │
│           │               │ COMMIT_SUCCESS                │       │
│           │               ▼                               │       │
│           │        ┌──────────────┐                       │       │
│           │        │  ADVANCING   │                       │       │
│           │        └──────┬───────┘                       │       │
│           │               │ ADVANCE_COMPLETE               │       │
│           │               ▼                               │       │
│           │    ┌─────────────────────┐                    │       │
│           │    │ continuousMode?     │                    │       │
│           │    ├──────┬──────────────┤                    │       │
│           │    │ YES  │ NO           │                    │       │
│           │    │  ────┼──────────────┼────► IDLE ─────────┘       │
│           │    │      │              │                             │
│           │    │      └──────────────┼► START_RECORDING ──────────┘│
│           │    └─────────────────────┘     (back to LISTENING)      │
│           │                                                          │
│           │  ┌───────┐                                              │
│           └─►│ ERROR │── auto-timeout (2s) ──► IDLE                │
│              └───────┘                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.3 Updated State Machine Implementation

This extends `§2.2` — replace `pointerReducer` with the version below, and update the driving hook to handle the auto-restart side effect.

```typescript
// lib/state-machines/pointer-state.ts  (updated)

export type PointerState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'confirming'
  | 'committing'
  | 'advancing'
  | 'error';

export type PointerEvent =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'TRANSCRIPTION_COMPLETE' }
  | { type: 'PARSE_COMPLETE' }
  | { type: 'USER_CONFIRMED' }
  | { type: 'USER_CANCELLED' }
  | { type: 'COMMIT_SUCCESS' }
  | { type: 'COMMIT_FAILED' }
  | { type: 'ADVANCE_COMPLETE' }
  | { type: 'AUTO_RESTART' }        // ← NEW: fired when continuousMode = true
  | { type: 'CONTINUOUS_STOPPED' }  // ← NEW: user exits continuous mode
  | { type: 'ERROR'; error: string };

export function pointerReducer(
  state: PointerState,
  event: PointerEvent
): PointerState {
  switch (state) {
    case 'idle':
      if (event.type === 'START_RECORDING') return 'listening';
      break;

    case 'listening':
      if (event.type === 'STOP_RECORDING')      return 'processing';
      if (event.type === 'CONTINUOUS_STOPPED')  return 'idle';
      if (event.type === 'ERROR')               return 'error';
      break;

    case 'processing':
      if (event.type === 'PARSE_COMPLETE')      return 'confirming';
      if (event.type === 'ERROR')               return 'error';
      break;

    case 'confirming':
      if (event.type === 'USER_CONFIRMED')      return 'committing';
      if (event.type === 'USER_CANCELLED')      return 'idle';
      break;

    case 'committing':
      if (event.type === 'COMMIT_SUCCESS')      return 'advancing';
      if (event.type === 'COMMIT_FAILED')       return 'error';
      break;

    case 'advancing':
      // AUTO_RESTART is dispatched by the hook when continuousMode = true
      if (event.type === 'AUTO_RESTART')        return 'listening';
      if (event.type === 'ADVANCE_COMPLETE')    return 'idle';
      break;

    case 'error':
      // Auto-return to idle handled by timeout in component
      // In continuous mode: auto-return to listening (see §10.4)
      break;
  }

  return state;
}
```

### 9.4 Navigation Hook — Continuous Mode Extension

This extends `§3.3` (Unified Navigation Hook). The only addition is the `useEffect` that watches for the `advancing` state and dispatches `AUTO_RESTART` when `continuousMode` is active.

```typescript
// lib/hooks/use-smart-pointer.ts  (continuous flow addition)

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import type { TableSchema } from '@/lib/types';

/**
 * Add this hook alongside the existing useNavigation hook.
 * It is responsible for the single continuous-flow side effect:
 * auto-restarting the VAD loop after the pointer advances.
 */
export function useContinuousAutoRestart(
  schema: TableSchema,
  onAutoRestart: () => void   // calls startVAD again
) {
  const recordingState = useUIStore((s) => s.recordingState);
  const continuousMode = useUIStore((s) => s.continuousMode);
  const advancePointer = useUIStore((s) => s.advancePointer);
  const setRecordingState = useUIStore((s) => s.setRecordingState);

  // Tracks whether we have already fired the restart for this advancing cycle
  const restartFiredRef = useRef(false);

  useEffect(() => {
    if (recordingState !== 'advancing') {
      restartFiredRef.current = false; // reset for next cycle
      return;
    }

    if (!continuousMode || restartFiredRef.current) return;

    restartFiredRef.current = true;

    // 1. Advance the pointer (same as non-continuous path)
    advancePointer(schema);

    // 2. Short pause so the user sees the green flash before we listen again
    const RESTART_DELAY_MS = 400;

    const timer = setTimeout(() => {
      if (!useUIStore.getState().continuousMode) return; // guard: user may have stopped
      setRecordingState('listening');
      onAutoRestart(); // re-activates the VAD loop in useContinuousVoice
    }, RESTART_DELAY_MS);

    return () => clearTimeout(timer);
  }, [recordingState, continuousMode, schema, advancePointer, setRecordingState, onAutoRestart]);
}
```

### 9.5 Continuous Mode UI Controls

The user needs clear, unambiguous controls to enter and exit continuous mode. These integrate into the existing `VoiceButton` component (`08_UI_COMPONENTS.md`).

```typescript
// components/ContinuousModeToggle.tsx

'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { Button }     from '@/components/ui/button';
import { Badge }      from '@/components/ui/badge';
import { Mic, MicOff, Infinity } from 'lucide-react';

interface ContinuousModeToggleProps {
  onStart: () => Promise<void>;
  onStop:  () => void;
}

export function ContinuousModeToggle({ onStart, onStop }: ContinuousModeToggleProps) {
  const continuousMode    = useUIStore((s) => s.continuousMode);
  const recordingState    = useUIStore((s) => s.recordingState);
  const setContinuousMode = useUIStore((s) => s.setContinuousMode);

  const isListening = continuousMode && recordingState === 'listening';

  const handleToggle = async () => {
    if (continuousMode) {
      setContinuousMode(false);
      onStop();
    } else {
      setContinuousMode(true);
      await onStart();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={continuousMode ? 'destructive' : 'outline'}
        size="sm"
        onClick={handleToggle}
        className="gap-2"
      >
        {continuousMode ? (
          <>
            <MicOff size={14} />
            Stop Continuous
          </>
        ) : (
          <>
            <Infinity size={14} />
            Continuous Mode
          </>
        )}
      </Button>

      {/* Live status badge — only visible in continuous mode */}
      {continuousMode && (
        <Badge
          variant={isListening ? 'default' : 'secondary'}
          className={isListening ? 'animate-pulse bg-red-500' : ''}
        >
          {isListening ? '● Listening' : recordingState}
        </Badge>
      )}

      {/* Keyboard hint */}
      {continuousMode && (
        <span className="text-xs text-zinc-400">Press Esc to stop</span>
      )}
    </div>
  );
}
```

```typescript
// Add Escape key handler to existing useKeyboardShortcuts hook (04_KEYBOARD_SHORTCUTS)

// In the keyboard handler useEffect, add:
if (e.key === 'Escape' && continuousMode) {
  e.preventDefault();
  setContinuousMode(false);
  onStop();
}
```

### 9.6 Continuous Flow — Full Sequence Diagram

```
┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌────────┐
│   User   │   │  VAD     │   │ Voice        │   │ Zustand  │   │  DB    │
│          │   │  Hook    │   │ Pipeline     │   │ Store    │   │        │
└────┬─────┘   └────┬─────┘   └──────┬───────┘   └────┬─────┘   └───┬────┘
     │              │                │                 │             │
     │ activate     │                │                 │             │
     │─────────────►│                │                 │             │
     │              │ getUserMedia   │                 │             │
     │              │ startAnalyser  │                 │             │
     │              │                │    listening    │             │
     │              │────────────────┼────────────────►│             │
     │              │                │                 │             │
     │ speaks       │                │                 │             │
     │──────────────►                │                 │             │
     │              │ onSpeechStart  │                 │             │
     │              │────────────────►                 │             │
     │              │                │                 │             │
     │ stops speaking│               │                 │             │
     │──────────────►                │                 │             │
     │              │ onSpeechEnd    │                 │             │
     │              │ (audioBlob)    │                 │             │
     │              │────────────────►                 │             │
     │              │                │  processing     │             │
     │              │                │────────────────►│             │
     │              │                │ transcribe()    │             │
     │              │                │ parse()         │             │
     │              │                │  confirming     │             │
     │              │                │────────────────►│             │
     │              │                │                 │             │
     │ confirms     │                │                 │             │
     │─────────────────────────────────────────────────►             │
     │              │                │  committing     │             │
     │              │                │────────────────►│             │
     │              │                │                 │ upsert      │
     │              │                │                 │────────────►│
     │              │                │                 │◄────────────│
     │              │                │  advancing      │             │
     │              │                │────────────────►│             │
     │              │                │                 │             │
     │              │ ◄── auto-restart after 400ms ────│             │
     │              │                │  listening      │             │
     │              │────────────────┼────────────────►│             │
     │              │                │                 │             │
     │ speaks again │                │                 │             │
     │──────────────►  (loop repeats)                  │             │
```

### 9.7 Continuous Flow Checklist

**Implementation:**
- [ ] `AUTO_RESTART` and `CONTINUOUS_STOPPED` events added to `pointerReducer`
- [ ] `useContinuousAutoRestart` hook wired to `advancePointer`
- [ ] `ContinuousModeToggle` component built and placed in table toolbar
- [ ] Escape key exits continuous mode
- [ ] 400 ms restart delay after green flash
- [ ] Error state in continuous mode auto-recovers to `listening` (not `idle`)

**Testing:**
- [ ] Two consecutive entries process without overlap
- [ ] Cancelling an entry in continuous mode returns to `listening` (not `idle`)
- [ ] Stopping continuous mode mid-processing does not leave mic open
- [ ] Escape key always exits regardless of current state
- [ ] After end-of-table in continuous mode, mode stops gracefully

**UX:**
- [ ] Pulsing red badge visible while VAD is listening
- [ ] State label updates in real time (listening / processing / confirming)
- [ ] Continuous mode visually distinct from push-to-talk at a glance


---

## 10. Smart Pointer Checklist

**Implementation:**
- [ ] Column-first navigation logic
- [ ] Row-first navigation logic
- [ ] Keyboard shortcuts
- [ ] Click navigation
- [ ] Mode toggle
- [ ] Visual highlighting
- [ ] Success animation
- [ ] Edge case handling

**Testing:**
- [ ] Navigate through entire table
- [ ] Wrap behavior at end of row/column
- [ ] Keyboard shortcuts work
- [ ] Mode switching works
- [ ] Visual feedback correct
- [ ] Persistence across page reload

**UX:**
- [ ] Clear visual indicator of active cell
- [ ] Smooth transitions between cells
- [ ] Mode clearly indicated
- [ ] End of table communicated
- [ ] Keyboard shortcuts documented

---

*End of Smart Pointer Documentation*