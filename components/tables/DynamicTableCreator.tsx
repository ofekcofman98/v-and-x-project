'use client';

/**
 * DynamicTableCreator - Full-screen Excel/Notion-style Grid for Table Creation
 * Supports generic table creation and Base List injection
 * Implements: docs/logs/REFACTOR_TABLE_CREATOR.md §2.1-2.3
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useColumnManager } from '@/components/shared-table/hooks/useColumnManager';
import { useRowManager } from '@/components/shared-table/hooks/useRowManager';
import { ColumnHeaderCell } from '@/components/shared-table/ColumnHeaderCell';
import { DataCell } from '@/components/shared-table/DataCell';
import type { ColumnDef, RowData, TableMetadata } from '@/components/shared-table/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BaseListSidebar } from './BaseListSidebar';
import { Database, X, Plus, Trash2 } from 'lucide-react';

interface DynamicTableCreatorProps {
  onClose: () => void;
  onSuccess?: (tableId: string) => void;
}

export function DynamicTableCreator({ onClose, onSuccess }: DynamicTableCreatorProps) {
  const [tableName, setTableName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBaseListId, setSelectedBaseListId] = useState<string | null>(null);
  const [tableMetadata, setTableMetadata] = useState<TableMetadata>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  
  const { columns, setColumns, addColumn, updateColumn, removeColumn } = useColumnManager([]);
  const { rows, setRows, addRow, updateCell, removeRow } = useRowManager([], columns);

  /**
   * Handle Base List selection - Inject columns and rows
   */
  const handleBaseListSelect = async (baseListId: string) => {
    try {
      const response = await fetch(`/api/base-lists/${baseListId}`);
      if (!response.ok) throw new Error('Failed to fetch base list');
      
      const { data: baseList } = await response.json();

      const injectedColumns: ColumnDef[] = baseList.schema.columns.map((col: { id: string; label: string; type: 'text' | 'number' | 'boolean' | 'date' }) => ({
        id: col.id,
        name: col.label,
        type: col.type,
        metadata: {
          source: 'base_list' as const,
          baseListColumnId: col.id,
          locked: true,
        },
      }));

      setColumns(injectedColumns);

      const injectedRows: RowData[] = baseList.entities?.map((entity: { id: string; values: Record<string, string> }) => ({
        id: entity.id,
        values: entity.values,
        metadata: {
          source: 'base_list' as const,
          entityId: entity.id,
          locked: true,
        },
      })) || [];

      setRows(injectedRows);

      setTableMetadata({
        baseListId: baseList.id,
        baseListName: baseList.name,
      });

      setSelectedBaseListId(baseListId);

      toast({
        title: 'Base List Loaded',
        description: `${baseList.name} injected with ${injectedRows.length} entities`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load base list',
        variant: 'destructive',
      });
    }
  };

  /**
   * Clear Base List and reset to generic mode
   */
  const clearBaseList = () => {
    if (window.confirm('Clear Base List injection? This will remove all Base List columns and rows.')) {
      setColumns([]);
      setRows([{ id: 'row_1', values: {}, metadata: { source: 'inline' } }]);
      setTableMetadata({});
      setSelectedBaseListId(null);
      
      toast({
        title: 'Base List Cleared',
        description: 'Switched to generic table mode',
      });
    }
  };

  /**
   * Handle cancel - Navigate back with confirmation
   */
  const handleCancel = () => {
    if (columns.length > 0 || tableName.trim()) {
      if (window.confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

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

    const col = columns.find((c) => c.id === colId);
    if (col?.metadata?.locked) {
      toast({
        title: 'Cannot Delete',
        description: 'This column is locked from the Base List.',
        variant: 'destructive',
      });
      return;
    }

    const success = removeColumn(colId);
    if (success) {
      // Clear column data from all rows
      setRows(rows.map((row) => {
        const { [colId]: _, ...rest } = row.values;
        return { ...row, values: rest };
      }));
    }
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

    const row = rows.find((r) => r.id === rowId);
    if (row?.metadata?.locked) {
      toast({
        title: 'Cannot Delete',
        description: 'This row is locked from the Base List.',
        variant: 'destructive',
      });
      return;
    }

    removeRow(rowId);
  };

  /**
   * Validate before submitting
   */
  const validate = (): string | null => {
    if (!tableName.trim()) {
      return 'Table name is required';
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
      // Use first column as representative column
      const representativeColumnKey = columns[0].name.toLowerCase().replace(/\s+/g, '_');

      // Transform columns to API format
      const apiColumns = columns.map((col) => ({
        label: col.name,
        type: col.type.toUpperCase() as 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE',
        validation: col.metadata?.source === 'base_list' ? {} : undefined,
      }));

      // Build payload
      const payload = {
        name: tableName,
        description: description || undefined,
        baseListId: tableMetadata.baseListId || undefined,
        representativeColumnKey,
        columns: apiColumns,
      };

      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create table' }));
        throw new Error(errorData.error || 'Failed to create table');
      }

      const { data } = await response.json();

      toast({
        title: 'Success',
        description: 'Table created successfully',
      });

      onSuccess?.(data.id);
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

  return (
    <div className="fixed inset-0 bg-background z-[100] flex w-full h-full opacity-100">
      {/* Left Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <BaseListSidebar 
          selectedId={selectedBaseListId}
          onSelect={handleBaseListSelect}
        />
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar: Meta Info */}
        <div className="border-b p-4 space-y-3">
          <Input 
            name="tableName" 
            placeholder="Table Name" 
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
          />
          <Textarea 
            name="description" 
            placeholder="Description" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {tableMetadata.baseListName && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Database className="h-4 w-4" />
              Using Base List: <strong>{tableMetadata.baseListName}</strong>
              <Button variant="ghost" size="sm" onClick={clearBaseList}>
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Grid Container */}
        <div className="flex-1 overflow-auto bg-slate-50">
          <div className="container max-w-7xl mx-auto px-6 py-8">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              {columns.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-lg font-medium text-slate-700 mb-2">No columns defined</p>
                  <p className="text-sm text-slate-500 mb-6">
                    Select a Base List from the sidebar or add custom columns to begin
                  </p>
                  <Button onClick={handleAddColumn} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Column
                  </Button>
                </div>
              ) : (
                <>
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

                      {/* Data Rows */}
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
                                  disabled={row.metadata?.locked}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Row Button */}
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
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t p-4 flex justify-between">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            Save Table
          </Button>
        </div>
      </div>
    </div>
  );
}
