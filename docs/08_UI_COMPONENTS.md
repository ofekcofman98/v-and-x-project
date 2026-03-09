# VocalGrid - UI Components

**Chapter:** 08  
**Dependencies:** 04_STATE_MANAGEMENT.md, 06_SMART_POINTER.md  
**Related:** 02_ARCHITECTURE.md, 05_VOICE_PIPELINE.md

---

## Table of Contents

1. [UI Component Architecture](#1-ui-component-architecture)
   - 1.1 [Component Hierarchy](#11-component-hierarchy)
   - 1.2 [Design System](#12-design-system)

2. [Core Components](#2-core-components)
   - 2.1 [DataTable Component](#21-datatable-component)
   - 2.2 [TableCell Component](#22-tablecell-component)
   - 2.3 [VoiceButton Component](#23-voicebutton-component)
   - 2.4 [ConfirmationDialog Component](#24-confirmationdialog-component)
   - 2.5 [NavigationModeToggle Component](#25-navigationmodetoggle-component)

3. [Layout Components](#3-layout-components)
   - 3.1 [TablePageLayout](#31-tablepagelayout)
   - 3.2 [Sidebar Navigation](#32-sidebar-navigation)
   - 3.3 [Header Component](#33-header-component)

4. [Feedback Components](#4-feedback-components)
   - 4.1 [Toast Notifications](#41-toast-notifications)
   - 4.2 [Loading States](#42-loading-states)
   - 4.3 [Empty States](#43-empty-states)
   - 4.4 [Error States](#44-error-states)

5. [Animation & Transitions](#5-animation--transitions)
   - 5.1 [Cell Success Animation](#51-cell-success-animation)
   - 5.2 [Pointer Movement Animation](#52-pointer-movement-animation)
   - 5.3 [Voice Recording Animation](#53-voice-recording-animation)

6. [Responsive Design](#6-responsive-design)
   - 6.1 [Mobile Adaptations](#61-mobile-adaptations)
   - 6.2 [Tablet Layout](#62-tablet-layout)
   - 6.3 [Desktop Layout](#63-desktop-layout)

7. [Accessibility](#7-accessibility)
   - 7.1 [ARIA Labels](#71-aria-labels)
   - 7.2 [Keyboard Navigation](#72-keyboard-navigation)
   - 7.3 [Screen Reader Support](#73-screen-reader-support)
   - 7.4 [Focus Management](#74-focus-management)

8. [Theming](#8-theming)
   - 8.1 [Light/Dark Mode](#81-lightdark-mode)
   - 8.2 [Color Palette](#82-color-palette)
   - 8.3 [Typography](#83-typography)

9. [Component Testing](#9-component-testing)
   - 9.1 [Unit Tests](#91-unit-tests)
   - 9.2 [Integration Tests](#92-integration-tests)
   - 9.3 [Visual Regression Tests](#93-visual-regression-tests)

10. [UI Components Checklist](#10-ui-components-checklist)

---

## 1. UI Component Architecture

### 1.1 Component Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYOUT                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  app/                                                       │
│  ├── layout.tsx (Root Layout)                               │
│  │   ├── Providers (QueryClient, Zustand)                  │
│  │   ├── Toaster (Global notifications)                    │
│  │   └── ThemeProvider                                     │
│  │                                                          │
│  ├── page.tsx (Home / Table List)                          │
│  │   ├── Header                                            │
│  │   ├── TableList                                         │
│  │   │   └── TableCard (×N)                                │
│  │   └── CreateTableButton                                 │
│  │                                                          │
│  └── table/[id]/page.tsx (Table View)                      │
│      ├── TablePageLayout                                   │
│      │   ├── TableHeader                                   │
│      │   │   ├── TableTitle                                │
│      │   │   ├── NavigationModeToggle                      │
│      │   │   └── ExportButton                              │
│      │   │                                                 │
│      │   ├── DataTable                                     │
│      │   │   ├── TableHeader (Column names)                │
│      │   │   └── TableBody                                 │
│      │   │       └── TableRow (×N)                         │
│      │   │           └── TableCell (×M)                    │
│      │   │               ├── CellValue                     │
│      │   │               ├── CellHighlight (if active)     │
│      │   │               └── SuccessAnimation (if commit)  │
│      │   │                                                 │
│      │   ├── VoiceControls                                 │
│      │   │   ├── VoiceButton                               │
│      │   │   ├── RecordingIndicator                        │
│      │   │   └── AudioLevelMeter                           │
│      │   │                                                 │
│      │   └── ConfirmationDialog (conditional)              │
│      │       ├── ParsedResult                              │
│      │       ├── ConfidenceScore                           │
│      │       └── ActionButtons                             │
│      │                                                     │
│      └── Modals/Dialogs                                    │
│          ├── DisambiguationDialog                          │
│          ├── EditTableDialog                               │
│          └── DeleteConfirmDialog                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Design System

**shadcn/ui Components Used:**
- Button
- Dialog / AlertDialog
- Dropdown Menu
- Toast
- Table
- Card
- Badge
- Separator
- Tooltip

**Custom Components:**
- VoiceButton (with audio visualization)
- DataTable (with smart pointer)
- ConfirmationDialog (voice-specific)
- NavigationModeToggle
- CellSuccessAnimation

---

## 2. Core Components

### 2.1 DataTable Component
```typescript
// components/DataTable.tsx

'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { TableSchema } from '@/types/schema';
import { TableCell } from './TableCell';
import { useKeyboardNavigation } from '@/lib/hooks/use-keyboard-navigation';

interface DataTableProps {
  schema: TableSchema;
  data: Array<{
    rowId: string;
    columnId: string;
    value: any;
  }>;
  onCellClick: (rowId: string, columnId: string) => void;
}

export function DataTable({ schema, data, onCellClick }: DataTableProps) {
  // Enable keyboard navigation
  useKeyboardNavigation(schema);
  
  // Helper to get cell value
  const getCellValue = (rowId: string, columnId: string) => {
    const cell = data.find(
      (d) => d.rowId === rowId && d.columnId === columnId
    );
    return cell?.value;
  };
  
  return (
    <div className="overflow-auto rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200">
        {/* Header */}
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {/* Empty corner cell */}
            </th>
            {schema.columns.map((column) => (
              <th
                key={column.id}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        
        {/* Body */}
        <tbody className="bg-white divide-y divide-gray-200">
          {schema.rows.map((row) => (
            <tr key={row.id}>
              {/* Row header */}
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50 sticky left-0">
                {row.label}
              </td>
              
              {/* Data cells */}
              {schema.columns.map((column) => (
                <TableCell
                  key={`${row.id}-${column.id}`}
                  rowId={row.id}
                  columnId={column.id}
                  columnType={column.type}
                  value={getCellValue(row.id, column.id)}
                  onClick={() => onCellClick(row.id, column.id)}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 2.2 TableCell Component
```typescript
// components/TableCell.tsx

'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils';
import { CellSuccessAnimation } from './CellSuccessAnimation';

interface TableCellProps {
  rowId: string;
  columnId: string;
  columnType: string;
  value: any;
  onClick: () => void;
}

export function TableCell({
  rowId,
  columnId,
  columnType,
  value,
  onClick,
}: TableCellProps) {
  const activeCell = useUIStore((state) => state.activeCell);
  const recordingState = useUIStore((state) => state.recordingState);
  
  const isActive =
    activeCell?.rowId === rowId && activeCell?.columnId === columnId;
  
  // Format value based on type
  const formattedValue = formatCellValue(value, columnType);
  
  return (
    <td
      onClick={onClick}
      className={cn(
        'px-4 py-3 whitespace-nowrap text-sm text-gray-900',
        'cursor-pointer transition-all duration-200 relative',
        'hover:bg-gray-50',
        
        // Active cell styles
        isActive && [
          'ring-2 ring-blue-500 ring-inset',
          'bg-blue-50',
          'font-medium',
          
          // State-specific background colors
          recordingState === 'listening' && 'bg-blue-100 animate-pulse',
          recordingState === 'processing' && 'bg-yellow-50',
          recordingState === 'confirming' && 'bg-orange-50',
        ]
      )}
    >
      {/* Value */}
      <span className="relative z-10">{formattedValue || '—'}</span>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-0 right-0 w-3 h-3">
          <div className="w-full h-full bg-blue-500 rounded-bl-lg" />
        </div>
      )}
      
      {/* Success animation */}
      <CellSuccessAnimation
        show={isActive && recordingState === 'committing'}
      />
    </td>
  );
}

// Helper function
function formatCellValue(value: any, type: string): string {
  if (value === null || value === undefined) return '';
  
  switch (type) {
    case 'number':
      return typeof value === 'number' ? value.toString() : value;
    case 'boolean':
      return value ? '✓' : '✗';
    case 'date':
      return value instanceof Date
        ? value.toLocaleDateString()
        : new Date(value).toLocaleDateString();
    case 'text':
    default:
      return value.toString();
  }
}
```

### 2.3 VoiceButton Component
```typescript
// components/VoiceButton.tsx

'use client';

import { useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/lib/stores/ui-store';
import { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder';
import { cn } from '@/lib/utils';

export function VoiceButton() {
  const recordingState = useUIStore((state) => state.recordingState);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder({
    onAudioLevel: setAudioLevel,
    onTranscriptReady: async (audioBlob) => {
      // Handle transcription (implemented elsewhere)
    },
    onError: (error) => {
      console.error('Recording error:', error);
    },
  });
  
  const handleMouseDown = () => {
    startRecording();
  };
  
  const handleMouseUp = () => {
    stopRecording();
  };
  
  const isProcessing = recordingState === 'processing' || recordingState === 'confirming';
  const isDisabled = isProcessing;
  
  return (
    <div className="relative flex flex-col items-center gap-2">
      {/* Main button */}
      <Button
        size="lg"
        disabled={isDisabled}
        className={cn(
          'relative rounded-full w-20 h-20 p-0 transition-all duration-200',
          isRecording && 'bg-red-500 hover:bg-red-600 scale-110',
          !isRecording && 'bg-blue-500 hover:bg-blue-600',
          isProcessing && 'bg-gray-400 cursor-not-allowed'
        )}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={isRecording ? handleMouseUp : undefined}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        {isProcessing ? (
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        ) : isRecording ? (
          <Square className="h-8 w-8 text-white" />
        ) : (
          <Mic className="h-8 w-8 text-white" />
        )}
        
        {/* Pulsing ring when recording */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-75" />
        )}
      </Button>
      
      {/* Audio level indicator */}
      {isRecording && (
        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-100"
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>
      )}
      
      {/* Status text */}
      <p className="text-xs text-gray-600 font-medium">
        {isRecording && 'Recording...'}
        {recordingState === 'processing' && 'Processing...'}
        {recordingState === 'confirming' && 'Confirming...'}
        {recordingState === 'idle' && 'Press & Hold to Record'}
      </p>
      
      {/* Keyboard hint */}
      {!isRecording && !isProcessing && (
        <p className="text-xs text-gray-400">
          or press <kbd className="px-1 py-0.5 bg-gray-100 rounded">Space</kbd>
        </p>
      )}
    </div>
  );
}
```

### 2.4 ConfirmationDialog Component
```typescript
// components/ConfirmationDialog.tsx

'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, AlertCircle } from 'lucide-react';

export function ConfirmationDialog() {
  const pendingConfirmation = useUIStore((state) => state.pendingConfirmation);
  const recordingState = useUIStore((state) => state.recordingState);
  const confirmEntry = useUIStore((state) => state.confirmEntry);
  const cancelEntry = useUIStore((state) => state.cancelEntry);
  
  const isOpen = recordingState === 'confirming' && !!pendingConfirmation;
  
  if (!pendingConfirmation) return null;
  
  const { entity, value, confidence, alternatives } = pendingConfirmation;
  
  // Auto-confirm for high confidence
  const autoConfirm = confidence >= 0.85;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && cancelEntry()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {autoConfirm ? (
              <>
                <Check className="h-5 w-5 text-green-500" />
                Confirm Entry
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Please Confirm
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {autoConfirm
              ? 'Auto-confirming in 2 seconds...'
              : 'Please verify this entry before saving.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Parsed result */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Entity:</span>
              <span className="font-semibold">{entity}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Value:</span>
              <span className="font-semibold">{value}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Confidence:</span>
              <span
                className={`font-semibold ${
                  confidence >= 0.9
                    ? 'text-green-600'
                    : confidence >= 0.7
                    ? 'text-orange-600'
                    : 'text-red-600'
                }`}
              >
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
          
          {/* Alternatives (if ambiguous) */}
          {alternatives && alternatives.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Or did you mean:</p>
              {alternatives.map((alt) => (
                <Button
                  key={alt.label}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    // Handle alternative selection
                  }}
                >
                  {alt.label}: {alt.value}
                </Button>
              ))}
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={confirmEntry}
              disabled={autoConfirm}
            >
              <Check className="h-4 w-4 mr-2" />
              Confirm
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={cancelEntry}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 2.5 NavigationModeToggle Component
```typescript
// components/NavigationModeToggle.tsx

'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NavigationModeToggle() {
  const navigationMode = useUIStore((state) => state.navigationMode);
  const setNavigationMode = useUIStore((state) => state.setNavigationMode);
  
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
      <Button
        size="sm"
        variant={navigationMode === 'column-first' ? 'default' : 'ghost'}
        onClick={() => setNavigationMode('column-first')}
        className={cn(
          'gap-1',
          navigationMode === 'column-first' && 'bg-blue-500 text-white hover:bg-blue-600'
        )}
      >
        <ArrowDown className="h-4 w-4" />
        Column
      </Button>
      
      <Button
        size="sm"
        variant={navigationMode === 'row-first' ? 'default' : 'ghost'}
        onClick={() => setNavigationMode('row-first')}
        className={cn(
          'gap-1',
          navigationMode === 'row-first' && 'bg-blue-500 text-white hover:bg-blue-600'
        )}
      >
        <ArrowRight className="h-4 w-4" />
        Row
      </Button>
    </div>
  );
}
```

---

## 3. Layout Components

### 3.1 TablePageLayout
```typescript
// components/layouts/TablePageLayout.tsx

'use client';

import { ReactNode } from 'react';
import { ArrowLeft, Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { NavigationModeToggle } from '@/components/NavigationModeToggle';

interface TablePageLayoutProps {
  children: ReactNode;
  tableName: string;
  onExport?: () => void;
  onSettings?: () => void;
}

export function TablePageLayout({
  children,
  tableName,
  onExport,
  onSettings,
}: TablePageLayoutProps) {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back button + Title */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                {tableName}
              </h1>
            </div>
            
            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              <NavigationModeToggle />
              
              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
              
              {onSettings && (
                <Button variant="ghost" size="sm" onClick={onSettings}>
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
```

### 3.2 Sidebar Navigation
```typescript
// components/layouts/Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Table, Settings, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Tables', href: '/tables', icon: Table },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  
  return (
    <aside className="w-64 bg-white border-r min-h-screen">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900">VocalGrid</h2>
      </div>
      
      <nav className="px-3 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

### 3.3 Header Component
```typescript
// components/layouts/Header.tsx

'use client';

import { Button } from '@/components/ui/button';
import { Bell, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">VocalGrid</h1>
          </div>
          
          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Button variant="ghost" size="sm">
              <Bell className="h-5 w-5" />
            </Button>
            
            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-5 w-5" />
                  <span>Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
```

---

## 4. Feedback Components

### 4.1 Toast Notifications
```typescript
// components/ui/toaster.tsx
// Using shadcn/ui toast component

import { useToast } from '@/components/ui/use-toast';
import { Toast, ToastProvider, ToastViewport } from '@/components/ui/toast';

export function Toaster() {
  const { toasts } = useToast();
  
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <div className="text-sm font-semibold">{title}</div>}
            {description && (
              <div className="text-sm opacity-90">{description}</div>
            )}
          </div>
          {action}
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

// Usage in components:
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

toast({
  title: 'Success!',
  description: 'Cell updated successfully.',
  variant: 'default',
});

toast({
  title: 'Error',
  description: 'Failed to update cell.',
  variant: 'destructive',
});
```

### 4.2 Loading States
```typescript
// components/LoadingStates.tsx

import { Loader2 } from 'lucide-react';

export function TableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="h-12 bg-gray-200 rounded" />
      
      {/* Rows skeleton */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded" />
      ))}
    </div>
  );
}

export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      {message && (
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
}

export function InlineLoader() {
  return (
    <Loader2 className="h-4 w-4 animate-spin inline-block" />
  );
}
```

### 4.3 Empty States
```typescript
// components/EmptyStates.tsx

import { Table, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyTableList({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Table className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No tables yet
      </h3>
      <p className="text-gray-600 mb-6 max-w-sm">
        Get started by creating your first table. You can use voice input to fill it quickly.
      </p>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4 mr-2" />
        Create Table
      </Button>
    </div>
  );
}

export function EmptyTableData() {
  return (
    <div className="text-center p-8 text-gray-500">
      <p>No data in this table yet.</p>
      <p className="text-sm mt-1">Use voice input to add entries.</p>
    </div>
  );
}
```

### 4.4 Error States
```typescript
// components/ErrorStates.tsx

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="rounded-full bg-red-100 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {message && (
        <p className="text-gray-600 mb-6 max-w-sm">{message}</p>
      )}
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}
```

---

## 5. Animation & Transitions

### 5.1 Cell Success Animation
```typescript
// components/CellSuccessAnimation.tsx

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

interface CellSuccessAnimationProps {
  show: boolean;
}

export function CellSuccessAnimation({ show }: CellSuccessAnimationProps) {
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
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{
              duration: 0.5,
              times: [0, 0.6, 1],
            }}
          >
            <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 5.2 Pointer Movement Animation
```typescript
// components/PointerTransition.tsx

'use client';

import { motion } from 'framer-motion';
import { useUIStore } from '@/lib/stores/ui-store';

export function PointerTransition({ children }: { children: React.ReactNode }) {
  const activeCell = useUIStore((state) => state.activeCell);
  
  return (
    <motion.div
      key={`${activeCell?.rowId}-${activeCell?.columnId}`}
      initial={{ scale: 0.95, opacity: 0.8 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
```

### 5.3 Voice Recording Animation
```typescript
// components/RecordingPulse.tsx

'use client';

import { motion } from 'framer-motion';

export function RecordingPulse() {
  return (
    <div className="relative">
      <motion.div
        className="absolute inset-0 rounded-full bg-red-500"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.2, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-red-500"
        animate={{
          scale: [1, 1.4, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.3,
        }}
      />
    </div>
  );
}
```

---

## 6. Responsive Design

### 6.1 Mobile Adaptations
```typescript
// components/responsive/MobileTableView.tsx

'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export function MobileTableView({ schema, data }: any) {
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  
  return (
    <div className="lg:hidden">
      {/* Mobile: Card-based view */}
      <div className="space-y-2">
        {schema.rows.map((row: any) => (
          <button
            key={row.id}
            onClick={() => setSelectedRow(row.id)}
            className="w-full p-4 bg-white border rounded-lg flex items-center justify-between hover:bg-gray-50"
          >
            <span className="font-medium">{row.label}</span>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        ))}
      </div>
      
      {/* Row detail sheet */}
      <Sheet open={!!selectedRow} onOpenChange={() => setSelectedRow(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {schema.rows.find((r: any) => r.id === selectedRow)?.label}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {schema.columns.map((col: any) => (
              <div key={col.id} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{col.label}</span>
                <span className="font-medium">
                  {/* Get cell value */}
                  {data.find(
                    (d: any) => d.rowId === selectedRow && d.columnId === col.id
                  )?.value || '—'}
                </span>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

### 6.2 Tablet Layout
```css
/* styles/responsive.css */

/* Tablet: 768px - 1024px */
@media (min-width: 768px) and (max-width: 1024px) {
  .table-container {
    padding: 1rem;
  }
  
  .voice-button {
    width: 64px;
    height: 64px;
  }
  
  .navigation-mode-toggle {
    font-size: 0.875rem;
  }
}
```

### 6.3 Desktop Layout
```css
/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .table-container {
    max-width: 1280px;
    margin: 0 auto;
  }
  
  .sidebar {
    display: block;
  }
  
  .voice-controls {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
  }
}
```

---

## 7. Accessibility

### 7.1 ARIA Labels
```typescript
// Proper ARIA labels for interactive elements

<button
  aria-label="Start voice recording"
  aria-pressed={isRecording}
  aria-describedby="voice-instructions"
>
  <Mic />
</button>

<div id="voice-instructions" className="sr-only">
  Press and hold to record, release to stop
</div>

<div
  role="grid"
  aria-label="Student grades table"
  aria-rowcount={rows.length}
  aria-colcount={columns.length}
>
  {/* Table content */}
</div>

<div
  role="gridcell"
  aria-selected={isActive}
  aria-label={`${rowLabel}, ${columnLabel}, ${value || 'empty'}`}
>
  {value}
</div>
```

### 7.2 Keyboard Navigation

All components support keyboard navigation:
- Tab: Navigate between interactive elements
- Arrow keys: Navigate table cells
- Enter: Activate selected element
- Escape: Close dialogs/cancel actions
- Space: Toggle voice recording

### 7.3 Screen Reader Support
```typescript
// Live region for status updates

export function LiveRegion() {
  const recordingState = useUIStore((state) => state.recordingState);
  
  const getMessage = () => {
    switch (recordingState) {
      case 'listening':
        return 'Recording audio';
      case 'processing':
        return 'Processing voice input';
      case 'confirming':
        return 'Please confirm the entry';
      case 'committing':
        return 'Saving entry';
      default:
        return '';
    }
  };
  
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {getMessage()}
    </div>
  );
}
```

### 7.4 Focus Management
```typescript
// components/FocusManager.tsx

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';

export function useFocusManagement() {
  const activeCell = useUIStore((state) => state.activeCell);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  
  useEffect(() => {
    if (activeCell) {
      const key = `${activeCell.rowId}-${activeCell.columnId}`;
      const element = cellRefs.current.get(key);
      
      if (element) {
        element.focus();
      }
    }
  }, [activeCell]);
  
  return {
    registerCell: (rowId: string, columnId: string, element: HTMLElement | null) => {
      if (element) {
        cellRefs.current.set(`${rowId}-${columnId}`, element);
      }
    },
  };
}
```

---

## 8. Theming

### 8.1 Light/Dark Mode
```typescript
// components/ThemeProvider.tsx

'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: 'system',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### 8.2 Color Palette
```typescript
// tailwind.config.ts

export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
    },
  },
};
```

### 8.3 Typography
```typescript
// Font configuration

import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Usage in layout:
<body className={inter.variable}>
  {children}
</body>

// Tailwind config:
fontFamily: {
  sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
},
```

---

## 9. Component Testing

### 9.1 Unit Tests
```typescript
// tests/components/TableCell.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { TableCell } from '@/components/TableCell';
import { describe, it, expect, vi } from 'vitest';

describe('TableCell', () => {
  it('should render cell value', () => {
    render(
      <TableCell
        rowId="row1"
        columnId="col1"
        columnType="text"
        value="Test Value"
        onClick={vi.fn()}
      />
    );
    
    expect(screen.getByText('Test Value')).toBeInTheDocument();
  });
  
  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    
    render(
      <TableCell
        rowId="row1"
        columnId="col1"
        columnType="text"
        value="Test"
        onClick={handleClick}
      />
    );
    
    fireEvent.click(screen.getByText('Test'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('should highlight when active', () => {
    // Test with Zustand mock
  });
});
```

### 9.2 Integration Tests
```typescript
// tests/integration/voice-input.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TablePage } from '@/app/table/[id]/page';

describe('Voice Input Integration', () => {
  it('should complete full voice input flow', async () => {
    render(<TablePage params={{ id: 'test-table' }} />);
    
    // Click voice button
    const voiceButton = screen.getByLabelText('Start voice recording');
    await userEvent.click(voiceButton);
    
    // Simulate recording
    // ... mock MediaRecorder
    
    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Confirm Entry')).toBeInTheDocument();
    });
    
    // Confirm
    const confirmButton = screen.getByText('Confirm');
    await userEvent.click(confirmButton);
    
    // Verify cell updated
    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
    });
  });
});
```

### 9.3 Visual Regression Tests
```typescript
// tests/visual/components.test.tsx

import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('DataTable component', async ({ page }) => {
    await page.goto('/table/test-id');
    
    // Wait for table to load
    await page.waitForSelector('table');
    
    // Take screenshot
    await expect(page).toHaveScreenshot('data-table.png');
  });
  
  test('VoiceButton - idle state', async ({ page }) => {
    await page.goto('/table/test-id');
    
    const button = page.locator('[aria-label="Start voice recording"]');
    await expect(button).toHaveScreenshot('voice-button-idle.png');
  });
  
  test('VoiceButton - recording state', async ({ page }) => {
    await page.goto('/table/test-id');
    
    const button = page.locator('[aria-label="Start voice recording"]');
    await button.click();
    
    await expect(button).toHaveScreenshot('voice-button-recording.png');
  });
});
```

---

## 10. UI Components Checklist

**Core Components:**
- [ ] DataTable with smart pointer
- [ ] TableCell with states
- [ ] VoiceButton with animations
- [ ] ConfirmationDialog
- [ ] NavigationModeToggle
- [ ] DisambiguationDialog

**Layout Components:**
- [ ] TablePageLayout
- [ ] Sidebar (optional)
- [ ] Header
- [ ] Footer (optional)

**Feedback Components:**
- [ ] Toast notifications
- [ ] Loading states (spinner, skeleton)
- [ ] Empty states
- [ ] Error states

**Animations:**
- [ ] Cell success animation
- [ ] Pointer transition
- [ ] Voice recording pulse
- [ ] Smooth transitions

**Responsive Design:**
- [ ] Mobile view (< 768px)
- [ ] Tablet view (768px - 1024px)
- [ ] Desktop view (> 1024px)

**Accessibility:**
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Focus management
- [ ] Color contrast compliance

**Theming:**
- [ ] Light/dark mode
- [ ] Consistent color palette
- [ ] Typography system

**Testing:**
- [ ] Unit tests for components
- [ ] Integration tests
- [ ] Visual regression tests
- [ ] Accessibility tests

---

*End of UI Components Documentation*