'use client';

/**
 * DynamicListCreator - Notion/Excel-style Grid for Base List Creation
 * Full-screen interactive table interface with inline editing
 * Implements: docs/logs/REFACTOR_LIST_CREATOR.md (Option A - Double-row header)
 * Refactored to use shared-table components (Phase 1)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useBaseListStore } from '@/lib/stores/base-list-store';
import { useColumnManager } from '@/components/shared-table/hooks/useColumnManager';
import { useRowManager } from '@/components/shared-table/hooks/useRowManager';
import { ColumnHeaderCell } from '@/components/shared-table/ColumnHeaderCell';
import { DataCell } from '@/components/shared-table/DataCell';
import type { ColumnDef } from '@/components/shared-table/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Save, X, ArrowLeft } from 'lucide-react';

/**
 * Component Props
 */
interface DynamicListCreatorProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Default starter column
 */
const DEFAULT_COLUMN: ColumnDef = {
  id: 'name',
  name: 'Name',
  type: 'text',
  metadata: {
    source: 'user_defined',
    locked: false,
  },
};

export function DynamicListCreator({ open, onClose, onSuccess }: DynamicListCreatorProps) {
  const [listName, setListName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { fetchLists } = useBaseListStore();

  const { columns, setColumns, addColumn, updateColumn, removeColumn } = useColumnManager([DEFAULT_COLUMN]);
  const { rows, setRows, addRow, updateCell, removeRow, clearColumn } = useRowManager([{ id: 'row_1', values: {}, metadata: { source: 'inline' } }], columns);

  if (!open) return null;

  /**
   * Add a new column
   */
  const handleAddColumn = () => {
    addColumn({
      id: `col_${Date.now()}`,
      name: '',
      type: 'text',
      metadata: {
        source: 'user_defined',
        locked: false,
      },
    });
  };

  /**
   * Remove a column with validation
   */
  const handleRemoveColumn = (colId: string) => {
    if (columns.length === 1) {
      toast({
        title: 'Cannot Delete',
        description: 'At least one column is required.',
        variant: 'destructive',
      });
      return;
    }

    const success = removeColumn(colId);
    if (!success) {
      toast({
        title: 'Cannot Delete',
        description: 'This column is locked.',
        variant: 'destructive',
      });
      return;
    }

    clearColumn(colId);
  };

  /**
   * Add a new row
   */
  const handleAddRow = () => {
    addRow({
      id: `row_${Date.now()}`,
      values: {},
      metadata: {
        source: 'inline',
      },
    });
  };

  /**
   * Remove a row with validation
   */
  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) {
      toast({
        title: 'Cannot Delete',
        description: 'At least one row must be present.',
        variant: 'destructive',
      });
      return;
    }
    
    const success = removeRow(rowId);
    if (!success) {
      toast({
        title: 'Cannot Delete',
        description: 'This row is locked.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Validate before submitting
   */
  const validate = (): string | null => {
    if (!listName.trim()) {
      return 'List name is required';
    }

    if (columns.length === 0) {
      return 'At least one column is required';
    }

    const emptyColumns = columns.filter((col) => !col.name.trim());
    if (emptyColumns.length > 0) {
      return `${emptyColumns.length} column(s) missing a name`;
    }

    const names = columns.map((col) => col.name.toLowerCase().trim());
    if (new Set(names).size !== names.length) {
      return 'Column names must be unique';
    }

    return null;
  };

  /**
   * Handle save - Transform to API format and submit
   */
  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: listName,
        description: description || undefined,
        schema: {
          columns: columns.map((col) => ({
            id: col.id,
            label: col.name,
            type: col.type,
            validation: col.id === 'name' ? { required: true } : {},
          })),
        },
        entities: rows
          .filter((row) => Object.values(row.values).some((v) => v.trim() !== ''))
          .map((row) => ({ values: row.values })),
      };

      const response = await fetch('/api/base-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create list' }));
        throw new Error(errorData.error || 'Failed to create list');
      }

      toast({
        title: 'Success',
        description: 'List created successfully',
      });

      await fetchLists();
      handleClose();
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Reset and close
   */
  const handleClose = () => {
    setListName('');
    setDescription('');
    setColumns([DEFAULT_COLUMN]);
    setRows([{ id: 'row_1', values: {}, metadata: { source: 'inline' } }]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Top Bar - Notion-style */}
      <div className="border-b border-slate-200 bg-white">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="Untitled List"
                  className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-slate-300"
                  style={{ width: listName ? `${listName.length + 2}ch` : '12ch' }}
                />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="text-sm text-slate-600 bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-slate-300"
                  style={{ width: description ? `${description.length + 2}ch` : '18ch' }}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={handleClose}
                className="h-9"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSubmitting}
                className="h-9"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save List'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Area - Notion/Excel style */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="container max-w-7xl mx-auto px-6 py-8">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="border-collapse">
                <thead>
                  {/* Row 1: Column Names */}
                  <tr className="border-b border-slate-200">
                    {columns.map((col) => (
                      <ColumnHeaderCell
                        key={col.id}
                        column={col}
                        onNameChange={(name) => updateColumn(col.id, { name })}
                        onTypeChange={(type) => updateColumn(col.id, { type })}
                        onDelete={() => handleRemoveColumn(col.id)}
                        showTypeSelector={false}
                      />
                    ))}
                    <th className="w-12 bg-slate-50 border-l border-slate-200">
                      <div className="flex items-center justify-center p-2">
                        <Button
                          onClick={handleAddColumn}
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
                        <Select
                          value={col.type}
                          onValueChange={(value) => updateColumn(col.id, { type: value as ColumnDef['type'] })}
                          disabled={col.metadata?.locked}
                        >
                          <SelectTrigger className="h-7 text-xs border bg-white hover:bg-slate-50 border-slate-200 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                          </SelectContent>
                        </Select>
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
                          onChange={(val) => updateCell(row.id, col.id, val)}
                          disabled={row.metadata?.locked}
                        />
                      ))}
                      <td className="border-l border-slate-200 p-1 bg-slate-50/30">
                        <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={() => handleRemoveRow(row.id)}
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Row Button - Clean footer */}
            <div className="border-t border-slate-200 bg-slate-50/30 p-2">
              <Button
                onClick={handleAddRow}
                variant="ghost"
                className="w-full justify-start text-slate-600 hover:bg-slate-50 hover:text-slate-900 h-8"
              >
                <Plus className="h-3.5 w-3.5 mr-2" />
                Add Row
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
