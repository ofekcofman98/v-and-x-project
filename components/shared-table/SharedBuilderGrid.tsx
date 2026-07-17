'use client';

import { Button } from '@/components/ui/button';
import { ColumnHeaderCell } from './ColumnHeaderCell';
import { DataCell } from './DataCell';
import { Plus, Trash2 } from 'lucide-react';
import { GridSelect } from './GridSelect';
import type { ColumnDef, RowData } from './types';

interface SharedBuilderGridProps {
  columns: ColumnDef[];
  rows: RowData[];
  representativeColumnId: string | null;
  onRepresentativeColumnChange: (columnId: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (colId: string) => void;
  onUpdateColumn: (colId: string, updates: Partial<ColumnDef>) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onUpdateCell: (rowId: string, colId: string, value: string) => void;
  /** Show "Add Row" footer and row-delete icons. Defaults to true. */
  allowRows?: boolean;
  /** Enable cell data entry. Defaults to true. */
  allowDataEntry?: boolean;
  /** Show the representative-column ("Voice Key") picker UI. Defaults to true. */
  showRepresentativeColumn?: boolean;
}

export function SharedBuilderGrid({
  columns,
  rows,
  representativeColumnId,
  onRepresentativeColumnChange,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumn,
  onAddRow,
  onRemoveRow,
  onUpdateCell,
  allowRows = true,
  allowDataEntry = true,
  showRepresentativeColumn = true,
}: SharedBuilderGridProps) {
  
  if (columns.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-lg shadow-sm">
        <p className="text-lg font-medium text-slate-700 mb-2">No columns defined</p>
        <p className="text-sm text-slate-500 mb-6">
          Select a Base List from the sidebar or add custom columns to begin
        </p>
        <Button onClick={onAddColumn} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add First Column
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="border-collapse w-full">
          <thead>
            {/* Row 1: Column Names */}
            <tr className="border-b border-slate-200">
              {columns.map((col) => (
                <ColumnHeaderCell
                  key={col.id}
                  column={col}
                  onNameChange={(name) => onUpdateColumn(col.id, { name })}
                  onTypeChange={(type) => onUpdateColumn(col.id, { type })}
                  onDelete={() => onRemoveColumn(col.id)}
                  showTypeSelector={false}
                  isRepresentative={showRepresentativeColumn && representativeColumnId === col.id}
                  onRepresentativeClick={
                    showRepresentativeColumn ? () => onRepresentativeColumnChange(col.id) : undefined
                  }
                />
              ))}
              <th className="w-12 bg-slate-50 border-l border-slate-200">
                <div className="flex items-center justify-center p-2">
                  <Button
                    onClick={onAddColumn}
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 hover:bg-slate-100"
                  >
                    <Plus className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              </th>
            </tr>

            {/* Row 2: Column Types */}
            <tr className="border-b border-slate-200 bg-slate-50/50">
              {columns.map((col) => (
                <th key={col.id} className="border-l first:border-l-0 border-slate-200 p-1">
                  <GridSelect
                    value={col.type}
                    onChange={(value) => onUpdateColumn(col.id, { type: value as ColumnDef['type'] })}
                    disabled={col.metadata?.locked}
                    options={[
                      { label: 'Text', value: 'text' },
                      { label: 'Number', value: 'number' },
                      { label: 'Boolean', value: 'boolean' },
                      { label: 'Date', value: 'date' },
                    ]}
                  />
                </th>
              ))}
              <th className="border-l border-slate-200"></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors group"
              >
                {columns.map((col) => (
                  <DataCell
                    key={col.id}
                    column={col}
                    value={row.values[col.id] || ''}
                    onChange={(val) => onUpdateCell(row.id, col.id, val)}
                    disabled={!allowDataEntry || col.metadata?.locked}
                  />
                ))}
                <td className="border-l border-slate-200 p-1 bg-slate-50/30">
                  {allowRows && (
                    <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={() => onRemoveRow(row.id)}
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                        disabled={row.metadata?.locked}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {allowRows && (
        <div className="border-t border-slate-200 bg-slate-50/30 p-2">
          <Button
            onClick={onAddRow}
            variant="ghost"
            className="w-full justify-start text-slate-600 hover:bg-slate-50 hover:text-slate-900 h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-2" />
            Add Row
          </Button>
        </div>
      )}
    </div>
  );
}