# VocalGrid - State Management

**Chapter:** 04  
**Dependencies:** 02_ARCHITECTURE.md, 03_DATABASE.md  
**Related:** 05_VOICE_PIPELINE.md, 08_UI_COMPONENTS.md

---

## Table of Contents

1. [State Management Strategy](#1-state-management-strategy)
   - 1.1 [Two-Layer Architecture](#11-two-layer-architecture)
   - 1.2 [Why This Approach?](#12-why-this-approach)

2. [Zustand (UI State)](#2-zustand-ui-state)
   - 2.1 [Store Definition](#21-store-definition)
   - 2.2 [Usage in Components](#22-usage-in-components)
   - 2.3 [Zustand DevTools](#23-zustand-devtools)

3. [TanStack Query (Server State)](#3-tanstack-query-server-state)
   - 3.1 [Setup](#31-setup)
   - 3.2 [Query Keys](#32-query-keys)
   - 3.3 [Queries](#33-queries)
   - 3.4 [Mutations (with Optimistic Updates)](#34-mutations-with-optimistic-updates)
   - 3.5 [Usage in Components](#35-usage-in-components)

4. [Real-time Sync (Supabase Subscriptions)](#4-real-time-sync-supabase-subscriptions)
   - 4.1 [Subscribe to Table Changes](#41-subscribe-to-table-changes)

5. [Persistence (Optional)](#5-persistence-optional)
   - 5.1 [Persist Preferences to LocalStorage](#51-persist-preferences-to-localstorage)
   - 5.2 [Persist Query Cache (Optional)](#52-persist-query-cache-optional)

6. [State Flow Examples](#6-state-flow-examples)
   - 6.1 [Voice Input → Cell Update Flow](#61-voice-input--cell-update-flow)
   - 6.2 [Collaborative Editing Flow](#62-collaborative-editing-flow)

7. [State Management Checklist](#7-state-management-checklist)

---

## 1. State Management Strategy

### 1.1 Two-Layer Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    STATE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ LAYER 1: UI State (Zustand)                       │     │
│  │ Scope: Client-only, ephemeral                     │     │
│  ├───────────────────────────────────────────────────┤     │
│  │                                                   │     │
│  │ • activeCell (which cell is selected)            │     │
│  │ • isRecording (microphone on/off)                │     │
│  │ • recordingState (idle/listening/processing)     │     │
│  │ • navigationMode (column-first/row-first)        │     │
│  │ • pendingConfirmation (awaiting user confirm)    │     │
│  │ • uiPreferences (theme, font size, etc.)         │     │
│  │                                                   │     │
│  │ Persistence: None (resets on page reload)        │     │
│  │                                                   │     │
│  └───────────────────────────────────────────────────┘     │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ LAYER 2: Server State (TanStack Query)            │     │
│  │ Scope: Server-synced, persistent                 │     │
│  ├───────────────────────────────────────────────────┤     │
│  │                                                   │     │
│  │ • tables (list of user's tables)                 │     │
│  │ • table (single table schema)                    │     │
│  │ • tableData (cell values for a table)            │     │
│  │                                                   │     │
│  │ Persistence: Supabase PostgreSQL                 │     │
│  │ Caching: TanStack Query (in-memory + optional    │     │
│  │          localStorage persistence)               │     │
│  │                                                   │     │
│  └───────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Why This Approach?

**Problem with mixing:**
```typescript
// ❌ BAD: Storing server data in Zustand
const useStore = create((set) => ({
  tables: [],  // This is server data!
  activeCell: null,  // This is UI state
}));

// Issues:
// - Manual sync with backend
// - No automatic refetching
// - No cache invalidation
// - No optimistic updates
```

**Solution: Separate concerns**
```typescript
// ✅ GOOD: Zustand for UI, TanStack Query for server

// UI state (Zustand)
const useUIStore = create((set) => ({
  activeCell: null,
  isRecording: false,
}));

// Server state (TanStack Query)
const { data: tables } = useQuery({
  queryKey: ['tables'],
  queryFn: fetchTables,
});

// Benefits:
// - Automatic caching
// - Background refetching
// - Optimistic updates
// - Devtools for debugging
```

---

## 2. Zustand (UI State)

### 2.1 Store Definition
```typescript
// lib/stores/ui-store.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ═══════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════

type RecordingState = 'idle' | 'listening' | 'processing' | 'confirming' | 'committed' | 'error';
type NavigationMode = 'column-first' | 'row-first';

interface ActiveCell {
  rowId: string;
  columnId: string;
}

interface PendingConfirmation {
  entity: string;
  value: any;
  confidence: number;
  alternatives?: Array<{
    label: string;
    value: any;
  }>;
}

interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  showConfidenceScores: boolean;
  autoAdvanceDelay: number;  // milliseconds
  voiceFeedbackEnabled: boolean;
}

// ═══════════════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════════════

interface UIStore {
  // State
  activeCell: ActiveCell | null;
  navigationMode: NavigationMode;
  isRecording: boolean;
  recordingState: RecordingState;
  currentTranscript: string | null;
  pendingConfirmation: PendingConfirmation | null;
  preferences: UIPreferences;
  
  // Actions
  setActiveCell: (cell: ActiveCell | null) => void;
  setNavigationMode: (mode: NavigationMode) => void;
  startRecording: () => void;
  stopRecording: () => void;
  setRecordingState: (state: RecordingState) => void;
  setTranscript: (transcript: string | null) => void;
  setPendingConfirmation: (confirmation: PendingConfirmation | null) => void;
  confirmEntry: () => void;
  cancelEntry: () => void;
  advancePointer: (schema: TableSchema) => void;
  updatePreferences: (preferences: Partial<UIPreferences>) => void;
  reset: () => void;
}

// ═══════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════

const defaultPreferences: UIPreferences = {
  theme: 'system',
  fontSize: 'medium',
  showConfidenceScores: true,
  autoAdvanceDelay: 2000,
  voiceFeedbackEnabled: false,
};

// ═══════════════════════════════════════════════════════════
// STORE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      activeCell: null,
      navigationMode: 'column-first',
      isRecording: false,
      recordingState: 'idle',
      currentTranscript: null,
      pendingConfirmation: null,
      preferences: defaultPreferences,
      
      // Actions
      setActiveCell: (cell) => set({ activeCell: cell }),
      
      setNavigationMode: (mode) => set({ navigationMode: mode }),
      
      startRecording: () => set({
        isRecording: true,
        recordingState: 'listening',
      }),
      
      stopRecording: () => set({
        isRecording: false,
        recordingState: 'processing',
      }),
      
      setRecordingState: (state) => set({ recordingState: state }),
      
      setTranscript: (transcript) => set({ currentTranscript: transcript }),
      
      setPendingConfirmation: (confirmation) => set({
        pendingConfirmation: confirmation,
        recordingState: confirmation ? 'confirming' : 'idle',
      }),
      
      confirmEntry: () => {
        // This triggers the mutation (handled in component)
        set({
          recordingState: 'committed',
          pendingConfirmation: null,
        });
      },
      
      cancelEntry: () => {
        set({
          recordingState: 'idle',
          pendingConfirmation: null,
          currentTranscript: null,
        });
      },
      
      advancePointer: (schema) => {
        const { activeCell, navigationMode } = get();
        if (!activeCell) return;
        
        const nextCell = calculateNextCell(
          activeCell,
          schema,
          navigationMode
        );
        
        set({ activeCell: nextCell });
      },
      
      updatePreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs },
      })),
      
      reset: () => set({
        activeCell: null,
        isRecording: false,
        recordingState: 'idle',
        currentTranscript: null,
        pendingConfirmation: null,
      }),
    }),
    { name: 'UIStore' }
  )
);

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function calculateNextCell(
  currentCell: ActiveCell,
  schema: TableSchema,
  mode: NavigationMode
): ActiveCell | null {
  if (mode === 'column-first') {
    // Move down (next row, same column)
    const currentRowIndex = schema.rows.findIndex(
      (r) => r.id === currentCell.rowId
    );
    const nextRow = schema.rows[currentRowIndex + 1];
    
    if (nextRow) {
      return {
        rowId: nextRow.id,
        columnId: currentCell.columnId,
      };
    } else {
      // End of column, move to next column, first row
      const currentColIndex = schema.columns.findIndex(
        (c) => c.id === currentCell.columnId
      );
      const nextCol = schema.columns[currentColIndex + 1];
      
      if (nextCol) {
        return {
          rowId: schema.rows[0].id,
          columnId: nextCol.id,
        };
      } else {
        // End of table
        return null;
      }
    }
  } else {
    // row-first: Move right (same row, next column)
    const currentColIndex = schema.columns.findIndex(
      (c) => c.id === currentCell.columnId
    );
    const nextCol = schema.columns[currentColIndex + 1];
    
    if (nextCol) {
      return {
        rowId: currentCell.rowId,
        columnId: nextCol.id,
      };
    } else {
      // End of row, move to next row, first column
      const currentRowIndex = schema.rows.findIndex(
        (r) => r.id === currentCell.rowId
      );
      const nextRow = schema.rows[currentRowIndex + 1];
      
      if (nextRow) {
        return {
          rowId: nextRow.id,
          columnId: schema.columns[0].id,
        };
      } else {
        // End of table
        return null;
      }
    }
  }
}
```

### 2.2 Usage in Components
```typescript
// components/DataTable.tsx

import { useUIStore } from '@/lib/stores/ui-store';

export function DataTable() {
  // Subscribe to specific slices (prevents unnecessary re-renders)
  const activeCell = useUIStore((state) => state.activeCell);
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const navigationMode = useUIStore((state) => state.navigationMode);
  
  const handleCellClick = (rowId: string, columnId: string) => {
    setActiveCell({ rowId, columnId });
  };
  
  return (
    <table>
      {/* Render cells, highlight active */}
      <tr>
        <td
          onClick={() => handleCellClick('john', 'quiz_1')}
          className={
            activeCell?.rowId === 'john' && activeCell?.columnId === 'quiz_1'
              ? 'bg-blue-100'
              : ''
          }
        >
          85
        </td>
      </tr>
    </table>
  );
}
```

### 2.3 Zustand DevTools
```typescript
// Enable Redux DevTools extension
import { devtools } from 'zustand/middleware';

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // ... store implementation
    }),
    { name: 'UIStore' }  // Name shown in DevTools
  )
);

// In browser console:
// Redux DevTools → Select "UIStore"
// See all state changes in real-time
```

---

## 3. TanStack Query (Server State)

### 3.1 Setup
```typescript
// app/providers.tsx

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10,   // 10 minutes (formerly cacheTime)
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```
```typescript
// app/layout.tsx

import { Providers } from './providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 3.2 Query Keys
```typescript
// lib/query-keys.ts

export const queryKeys = {
  // Tables
  tables: ['tables'] as const,
  table: (id: string) => ['tables', id] as const,
  
  // Table data
  tableData: (tableId: string) => ['tables', tableId, 'data'] as const,
  
  // User
  user: ['user'] as const,
};

// Usage:
// queryKey: queryKeys.table('abc-123')
// → ['tables', 'abc-123']
```

### 3.3 Queries
```typescript
// lib/queries/tables.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query-keys';

// ═══════════════════════════════════════════════════════════
// FETCH ALL TABLES
// ═══════════════════════════════════════════════════════════

export function useTables() {
  return useQuery({
    queryKey: queryKeys.tables,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ═══════════════════════════════════════════════════════════
// FETCH SINGLE TABLE
// ═══════════════════════════════════════════════════════════

export function useTable(tableId: string) {
  return useQuery({
    queryKey: queryKeys.table(tableId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!tableId, // Only run if tableId exists
  });
}

// ═══════════════════════════════════════════════════════════
// FETCH TABLE DATA
// ═══════════════════════════════════════════════════════════

export function useTableData(tableId: string) {
  return useQuery({
    queryKey: queryKeys.tableData(tableId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_data')
        .select('*')
        .eq('table_id', tableId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!tableId,
    staleTime: 1000 * 30, // 30 seconds (fresher data)
  });
}
```

### 3.4 Mutations (with Optimistic Updates)
```typescript
// lib/mutations/table-data.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query-keys';

// ═══════════════════════════════════════════════════════════
// UPDATE CELL
// ═══════════════════════════════════════════════════════════

interface UpdateCellParams {
  tableId: string;
  rowId: string;
  columnId: string;
  value: any;
}

export function useUpdateCell() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: UpdateCellParams) => {
      const { data, error } = await supabase
        .from('table_data')
        .upsert({
          table_id: params.tableId,
          row_id: params.rowId,
          column_id: params.columnId,
          value: { v: params.value },
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // ═══════════════════════════════════════════════════════
    // OPTIMISTIC UPDATE (Instant UI)
    // ═══════════════════════════════════════════════════════
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.tableData(newData.tableId),
      });
      
      // Snapshot previous value (for rollback)
      const previousData = queryClient.getQueryData(
        queryKeys.tableData(newData.tableId)
      );
      
      // Optimistically update cache
      queryClient.setQueryData(
        queryKeys.tableData(newData.tableId),
        (old: any[] | undefined) => {
          if (!old) return old;
          
          const existingIndex = old.findIndex(
            (item) =>
              item.row_id === newData.rowId &&
              item.column_id === newData.columnId
          );
          
          if (existingIndex >= 0) {
            // Update existing
            const updated = [...old];
            updated[existingIndex] = {
              ...updated[existingIndex],
              value: { v: newData.value },
              updated_at: new Date().toISOString(),
            };
            return updated;
          } else {
            // Add new
            return [
              ...old,
              {
                id: crypto.randomUUID(),
                table_id: newData.tableId,
                row_id: newData.rowId,
                column_id: newData.columnId,
                value: { v: newData.value },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];
          }
        }
      );
      
      // Return context for rollback
      return { previousData };
    },
    
    // ═══════════════════════════════════════════════════════
    // ERROR HANDLING (Rollback)
    // ═══════════════════════════════════════════════════════
    onError: (err, newData, context) => {
      // Rollback to previous data
      queryClient.setQueryData(
        queryKeys.tableData(newData.tableId),
        context?.previousData
      );
      
      // Show error toast
      console.error('Update failed:', err);
    },
    
    // ═══════════════════════════════════════════════════════
    // SUCCESS (Refetch to ensure sync)
    // ═══════════════════════════════════════════════════════
    onSettled: (data, error, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.tableData(variables.tableId),
      });
    },
  });
}

// ═══════════════════════════════════════════════════════════
// CREATE TABLE
// ═══════════════════════════════════════════════════════════

interface CreateTableParams {
  name: string;
  description?: string;
  schema: TableSchema;
}

export function useCreateTable() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: CreateTableParams) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('tables')
        .insert({
          user_id: user.user.id,
          name: params.name,
          description: params.description,
          schema: params.schema,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    onSuccess: () => {
      // Refetch tables list
      queryClient.invalidateQueries({ queryKey: queryKeys.tables });
    },
  });
}

// ═══════════════════════════════════════════════════════════
// DELETE TABLE
// ═══════════════════════════════════════════════════════════

export function useDeleteTable() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId);
      
      if (error) throw error;
    },
    
    onSuccess: () => {
      // Refetch tables list
      queryClient.invalidateQueries({ queryKey: queryKeys.tables });
    },
  });
}
```

### 3.5 Usage in Components
```typescript
// app/table/[id]/page.tsx

'use client';

import { useTable, useTableData } from '@/lib/queries/tables';
import { useUpdateCell } from '@/lib/mutations/table-data';
import { useUIStore } from '@/lib/stores/ui-store';

export default function TablePage({ params }: { params: { id: string } }) {
  const { data: table, isLoading: tableLoading } = useTable(params.id);
  const { data: tableData, isLoading: dataLoading } = useTableData(params.id);
  const updateCell = useUpdateCell();
  
  const activeCell = useUIStore((state) => state.activeCell);
  const confirmEntry = useUIStore((state) => state.confirmEntry);
  const pendingConfirmation = useUIStore((state) => state.pendingConfirmation);
  
  const handleConfirm = () => {
    if (!pendingConfirmation || !activeCell) return;
    
    // Trigger mutation (with optimistic update)
    updateCell.mutate({
      tableId: params.id,
      rowId: activeCell.rowId,
      columnId: activeCell.columnId,
      value: pendingConfirmation.value,
    });
    
    // Clear pending state
    confirmEntry();
  };
  
  if (tableLoading || dataLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div>
      <h1>{table.name}</h1>
      <DataTable schema={table.schema} data={tableData} />
      
      {pendingConfirmation && (
        <ConfirmDialog
          confirmation={pendingConfirmation}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
```

---

## 4. Real-time Sync (Supabase Subscriptions)

### 4.1 Subscribe to Table Changes
```typescript
// lib/hooks/use-realtime-table-data.ts

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query-keys';

export function useRealtimeTableData(tableId: string) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // Subscribe to changes on table_data
    const channel = supabase
      .channel(`table:${tableId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'table_data',
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          console.log('Real-time update:', payload);
          
          // Invalidate query to refetch
          queryClient.invalidateQueries({
            queryKey: queryKeys.tableData(tableId),
          });
        }
      )
      .subscribe();
    
    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, queryClient]);
}

// Usage in component:
useRealtimeTableData(tableId);
```

---

## 5. Persistence (Optional)

### 5.1 Persist Preferences to LocalStorage
```typescript
// lib/stores/ui-store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // ... store implementation
    }),
    {
      name: 'vocalgrid-ui-preferences', // localStorage key
      
      // Only persist preferences, not transient state
      partialize: (state) => ({
        preferences: state.preferences,
        navigationMode: state.navigationMode,
      }),
    }
  )
);

// Preferences will be restored on page reload
```

### 5.2 Persist Query Cache (Optional)
```typescript
// lib/query-client.ts

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

// Wrap app with PersistQueryClientProvider
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister }}
>
  {children}
</PersistQueryClientProvider>

// Query results will persist across page reloads
```

---

## 6. State Flow Examples

### 6.1 Voice Input → Cell Update Flow
```
┌────────────────────────────────────────────────────────────┐
│ 1. USER: Press record button                              │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 2. ZUSTAND: startRecording()                              │
│    • isRecording = true                                    │
│    • recordingState = 'listening'                          │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 3. COMPONENT: Record audio (Browser API)                  │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 4. ZUSTAND: stopRecording()                               │
│    • isRecording = false                                   │
│    • recordingState = 'processing'                         │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 5. COMPONENT: Call API (/api/transcribe + /api/parse)     │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 6. ZUSTAND: setPendingConfirmation(result)                │
│    • recordingState = 'confirming'                         │
│    • pendingConfirmation = { entity, value, confidence }   │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 7. COMPONENT: Show confirmation dialog                    │
│    (if confidence < 0.85)                                  │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 8. USER: Confirm (or auto-confirm after 2s)               │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 9. ZUSTAND: confirmEntry()                                │
│    • recordingState = 'committed'                          │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 10. TANSTACK QUERY: updateCell.mutate()                   │
│     • onMutate: Optimistic update (instant UI)             │
│     • mutationFn: Supabase upsert                          │
│     • onSuccess: Cell flashes green                        │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ 11. ZUSTAND: advancePointer()                             │
│     • activeCell = next cell (based on mode)               │
│     • recordingState = 'idle'                              │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Collaborative Editing Flow
```
┌────────────────────────────────────────────────────────────┐
│ USER A: Updates cell (John, Quiz 1) = 85                  │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ TANSTACK QUERY (User A):                                  │
│ • Optimistic update (instant UI for User A)                │
│ • Mutation to Supabase                                     │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ SUPABASE: Database write + Real-time broadcast            │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│ USER B (Subscribed via useRealtimeTableData):             │
│ • Receives real-time event                                 │
│ • TanStack Query invalidates cache                         │
│ • Refetches latest data                                    │
│ • UI updates with User A's change                          │
└────────────────────────────────────────────────────────────┘
```

---

## 7. State Management Checklist

**Before Implementation:**
- [ ] Zustand store defined
- [ ] TanStack Query setup
- [ ] Query keys centralized
- [ ] Optimistic updates implemented
- [ ] Error handling (rollback)
- [ ] Real-time subscriptions (optional)
- [ ] DevTools enabled (development)

**Testing:**
- [ ] Zustand actions work correctly
- [ ] Queries cache properly
- [ ] Mutations update optimistically
- [ ] Rollback works on error
- [ ] Real-time sync works (if enabled)
- [ ] No unnecessary re-renders (use React DevTools Profiler)

---

*End of State Management Documentation*