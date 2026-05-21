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
import type { ColumnDef, RowData, TableMetadata } from '@/components/shared-table/types';
import { validateGridSchema } from '@/lib/utils/table-validation';
import { SharedBuilderGrid } from '@/components/shared-table/SharedBuilderGrid';
import { useGridBuilder } from '@/components/shared-table/hooks/useGridBuilder';
import { BaseListSidebar } from './BaseListSidebar';
import { Database, X } from 'lucide-react';

interface DynamicTableCreatorProps {
  onClose: () => void;
  onSuccess?: (tableId: string) => void;
}

export function DynamicTableCreator({ onClose, onSuccess }: DynamicTableCreatorProps) {
  const { toast } = useToast();
  
  const {
    state: { name: tableName, description, isSubmitting, columns, rows },
    setters: { setName: setTableName, setDescription, setIsSubmitting, setColumns, setRows },
    gridActions
  } = useGridBuilder();

  const [selectedBaseListId, setSelectedBaseListId] = useState<string | null>(null);
  const [tableMetadata, setTableMetadata] = useState<TableMetadata>({});

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
   * Handle save - Transform to API format and submit
   */
  const handleSave = async () => {
    const validationError = validateGridSchema(tableName, columns);
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
      const representativeColumnKey = columns[0].id;

      // Transform columns to API format
      const apiColumns = columns
      .filter((col) => col.metadata?.source !== 'base_list')
      .map((col) => ({
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
            <SharedBuilderGrid
              columns={columns}
              rows={rows}
              {...gridActions}
            />
          </div>
        </div>

        {/* Bottom Actions (This was the part that got cut off!) */}
        <div className="border-t p-4 flex justify-between bg-white">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Table'}
          </Button>
        </div>
      </div>
    </div>
  );
}