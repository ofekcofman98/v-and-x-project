/**
 * DataTable Demo Page
 * Showcases the DataTable component with Smart Pointer integration
 */

'use client';

import { DataTable } from '@/components/table/DataTable';
import { MobileTableView } from '@/components/table/MobileTableView';
import { VoiceButton } from '@/components/voice';
import { useUIStore } from '@/lib/stores/ui-store';
import { ColumnType } from '@/lib/types/column-types';
import type {
  ColumnDefinition,
  RowDefinition,
  CellData,
  TableSchema,
} from '@/lib/types/table-schema';

// Mock Data - Student Grades Example from docs/03_DATABASE.md
const columns: ColumnDefinition[] = [
  {
    id: 'entity',
    label: 'Entity',
    type: ColumnType.TEXT,
  },
  {
    id: 'value',
    label: 'Value',
    type: ColumnType.NUMBER,
  },
  {
    id: 'status',
    label: 'Status',
    type: ColumnType.TEXT,
  },
];

const rows: RowDefinition[] = [
  { id: 'row1', label: 'Student A' },
  { id: 'row2', label: 'Student B' },
  { id: 'row3', label: 'Student C' },
  { id: 'row4', label: 'Student D' },
  { id: 'row5', label: 'Student E' },
];

const mockData: CellData[] = [
  { rowId: 'row1', columnId: 'entity', value: 'Alice Smith' },
  { rowId: 'row1', columnId: 'value', value: 95 },
  { rowId: 'row1', columnId: 'status', value: 'Complete' },
  
  { rowId: 'row2', columnId: 'entity', value: 'Bob Johnson' },
  { rowId: 'row2', columnId: 'value', value: 87 },
  { rowId: 'row2', columnId: 'status', value: 'Complete' },
  
  { rowId: 'row3', columnId: 'entity', value: 'Charlie Brown' },
  { rowId: 'row3', columnId: 'value', value: 92 },
  { rowId: 'row3', columnId: 'status', value: 'Pending' },
  
  { rowId: 'row4', columnId: 'entity', value: 'Diana Prince' },
  { rowId: 'row4', columnId: 'value', value: 88 },
  { rowId: 'row4', columnId: 'status', value: 'Complete' },
  
  { rowId: 'row5', columnId: 'entity', value: 'Eve Wilson' },
  { rowId: 'row5', columnId: 'value', value: 91 },
  { rowId: 'row5', columnId: 'status', value: 'Pending' },
];

export default function DataTableDemoPage() {
  const activeCell = useUIStore((state) => state.activeCell);
  const recordingState = useUIStore((state) => state.recordingState);
  const pendingConfirmation = useUIStore((state) => state.pendingConfirmation);
  const setActiveCell = useUIStore((state) => state.setActiveCell);
  const setRecordingState = useUIStore((state) => state.setRecordingState);
  const tableSchema: TableSchema = { columns, rows };
  
  const handleCellClick = (rowId: string, columnId: string) => {
    console.log('Cell clicked:', { rowId, columnId });
  };
  
  const handleRecordingStateChange = (state: typeof recordingState) => {
    setRecordingState(state);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Data Table Demo
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Click any cell to highlight it with the Smart Pointer
          </p>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Control Panel */}
        <div className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Smart Pointer Controls
          </h2>
          
          {/* Active Cell Info */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Active Cell:
            </p>
            <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
              {activeCell ? (
                <>
                  Row: <span className="font-semibold">{activeCell.rowId}</span>
                  {' | '}
                  Column: <span className="font-semibold">{activeCell.columnId}</span>
                </>
              ) : (
                <span className="text-gray-500 dark:text-gray-500">None selected</span>
              )}
            </div>
          </div>
          
          {/* Recording State Controls */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Simulate Recording States:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleRecordingStateChange('idle')}
                className="px-4 py-2 text-sm rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
              >
                Idle
              </button>
              <button
                onClick={() => handleRecordingStateChange('listening')}
                className="px-4 py-2 text-sm rounded bg-blue-500 hover:bg-blue-600 text-white"
              >
                Listening
              </button>
              <button
                onClick={() => handleRecordingStateChange('processing')}
                className="px-4 py-2 text-sm rounded bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                Processing
              </button>
              <button
                onClick={() => handleRecordingStateChange('confirming')}
                className="px-4 py-2 text-sm rounded bg-orange-500 hover:bg-orange-600 text-white"
              >
                Confirming
              </button>
              <button
                onClick={() => handleRecordingStateChange('committing')}
                className="px-4 py-2 text-sm rounded bg-green-500 hover:bg-green-600 text-white"
              >
                Committing
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Current state: <span className="font-semibold">{recordingState}</span>
            </p>
          </div>
          
          {/* Quick Select Cells */}
          <div className="mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Quick Select Cell:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCell({ rowId: 'row1', columnId: 'entity' })}
                className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                A - Entity
              </button>
              <button
                onClick={() => setActiveCell({ rowId: 'row2', columnId: 'value' })}
                className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                B - Value
              </button>
              <button
                onClick={() => setActiveCell({ rowId: 'row3', columnId: 'status' })}
                className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                C - Status
              </button>
              <button
                onClick={() => setActiveCell(null)}
                className="px-3 py-1 text-xs rounded border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-red-900 dark:text-red-100"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden lg:block">
          <DataTable
            columns={columns}
            rows={rows}
            data={mockData}
            onCellClick={handleCellClick}
          />
        </div>
        
        {/* Mobile Table View */}
        <MobileTableView
          columns={columns}
          rows={rows}
          data={mockData}
          onCellClick={handleCellClick}
        />
        
        {/* Instructions */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            💡 How to Use
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Click any cell in the table to activate the Smart Pointer</li>
            <li>• The active cell will have a blue border and corner indicator</li>
            <li>• Use the buttons above to simulate different recording states</li>
            <li>• Notice how the cell background changes based on the state</li>
            <li>• On mobile, tap a row to expand and see all columns</li>
            <li>• Press and hold the voice button below to test recording</li>
          </ul>
        </div>
        
        {/* Voice Button */}
        <div className="mt-8 flex justify-center">
          <VoiceButton tableSchema={tableSchema} />
        </div>

        {pendingConfirmation && (
          <div className="mt-4 max-w-md mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Parsed Result:
            </p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Entity: {pendingConfirmation.entity || '—'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Value: {String(pendingConfirmation.value ?? '—')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Confidence: {(pendingConfirmation.confidence * 100).toFixed(0)}%
            </p>
            {pendingConfirmation.alternatives?.length ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Alternatives: {pendingConfirmation.alternatives.map((alt) => alt.label).join(', ')}
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
