'use client';

/**
 * DynamicTableCreator - Full-screen Excel/Notion-style Grid for Table Creation
 * Supports generic table creation and Base List injection
 * Implements: docs/logs/REFACTOR_TABLE_CREATOR.md §2.1-2.3
 */

import { useState, useEffect } from 'react';
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

import { cn } from '@/lib/utils/cn';
import { useColumnTemplateStore } from '@/lib/stores/column-template-store';

const CATEGORY_EMOJI: Record<string, string> = {
  education:  '🎓',
  hr:         '👔',
  inventory:  '📦',
  finance:    '💰',
  healthcare: '🏥',
  custom:     '⚙️',
};

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

  const { templates, isLoading: templatesLoading, fetchTemplates } = useColumnTemplateStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedBaseListId, setSelectedBaseListId] = useState<string | null>(null);
  const [tableMetadata, setTableMetadata] = useState<TableMetadata>({});
  const [representativeColumnId, setRepresentativeColumnId] = useState<string | null>(null);

  /**
   * Auto-select first TEXT column as representative if none is selected
   */
  useEffect(() => {
    if (!representativeColumnId && columns.length > 0) {
      const firstTextColumn = columns.find(col => col.type === 'text');
      if (firstTextColumn) {
        setRepresentativeColumnId(firstTextColumn.id);
      }
    }
    
    const currentRepColumn = columns.find(col => col.id === representativeColumnId);
    if (representativeColumnId && (!currentRepColumn || currentRepColumn.type !== 'text')) {
      const firstTextColumn = columns.find(col => col.type === 'text');
      setRepresentativeColumnId(firstTextColumn?.id || null);
    }
  }, [columns, representativeColumnId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  /**
   * Handle Base List selection - Inject columns and rows
  */

  const handleBaseListSelect = async (baseListId: string) => {
    try {
      const response = await fetch(`/api/base-lists/${baseListId}`);
      if (!response.ok) throw new Error('Failed to fetch base list');
      
      const { data: baseList } = await response.json();

      const injectedColumns: ColumnDef[] = baseList.schema.columns.map((col: { id: string; label: string; type: string }) => ({
        id: col.id,
        name: col.label,
        type: (col.type || 'text').toLowerCase() as ColumnDef['type'],
        metadata: {
          source: 'base_list' as const,
          baseListColumnId: col.id,
          locked: true,
        },
      }));

      // Preserve any active template columns after the new base_list columns
      const activeTemplateCols = columns.filter(
        (col) => col.metadata?.source === 'template'
      );
      setColumns([...injectedColumns, ...activeTemplateCols]);

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

      const firstTextColumn = injectedColumns.find(col => col.type === 'text');
      if (firstTextColumn) {
        setRepresentativeColumnId(firstTextColumn.id);
      }

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

  const handleTemplateSelect = async (templateId: string) => {
    // Deselect: strip template columns only, leaving base_list + user_defined intact
    if (selectedTemplateId === templateId) {
      setColumns((prev) => prev.filter((col) => col.metadata?.source !== 'template'));
      setSelectedTemplateId(null);
      return;
    }

    try {
      const response = await fetch(`/api/column-templates/${templateId}`, {
        headers: { 'x-user-id': '00000000-0000-0000-0000-000000000000' },
      });
      if (!response.ok) throw new Error('Failed to fetch template');

      const { data: template } = await response.json();

      const rawTemplateColumns = template.schema.columns.map(
        (col: { id: string; label: string; type: string }) => ({
          id: col.id,
          name: col.label,
          type: (col.type || 'text').toLowerCase() as ColumnDef['type'],
          metadata: { source: 'template' as const, locked: false },
        })
      );

      // Strip previous template columns, then append de-duplicated new ones.
      // IDs are de-duplicated against the surviving (non-template) columns so
      // React never sees two children with the same key.
      setColumns((prev) => {
        const base = prev.filter((col) => col.metadata?.source !== 'template');
        const occupiedIds = new Set(base.map((col) => col.id));

        const dedupedTemplateColumns: ColumnDef[] = rawTemplateColumns.map(
          (col: ColumnDef) => {
            if (!occupiedIds.has(col.id)) return col;
            const uniqueId = `${col.id}_tpl`;
            return { ...col, id: uniqueId };
          }
        );

        return [...base, ...dedupedTemplateColumns];
      });
      setSelectedTemplateId(templateId);

      toast({
        title: 'Template Applied',
        description: `${template.name} added ${rawTemplateColumns.length} column${rawTemplateColumns.length === 1 ? '' : 's'}`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load template',
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
      setRepresentativeColumnId(null);
      
      toast({
        title: 'Base List Cleared',
        description: 'Switched to generic table mode',
      });
    }
  };

  /**
   * Handle representative column selection
   */
  const handleRepresentativeColumnChange = (columnId: string) => {
    setRepresentativeColumnId(columnId);
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
      const representativeColumnKey = representativeColumnId || columns[0]?.id;

      if (!representativeColumnKey) {
        throw new Error('No columns defined');
      }

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

        {/* Template Track */}
        <div className="border-b bg-muted/20 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Column Templates
            </span>
            {selectedTemplateId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setSelectedTemplateId(null)}
              >
                Clear
              </Button>
            )}
          </div>

          {templatesLoading ? (
            <p className="text-xs text-muted-foreground py-1">Loading templates…</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No templates available</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex gap-3 pb-2 w-max">
                {templates.map((template) => {
                  const emoji = CATEGORY_EMOJI[template.category?.toLowerCase() ?? ''] ?? '📐';
                  const isSelected = selectedTemplateId === template.id;
                  const colCount = template.schema?.columns?.length ?? '?';

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateSelect(template.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-left',
                        'text-sm whitespace-nowrap transition-all duration-150',
                        'hover:shadow-md hover:ring-2 hover:ring-purple-500/40',
                        isSelected
                          ? 'ring-2 ring-primary border-primary shadow-sm bg-primary/5'
                          : 'border-border hover:border-purple-300'
                      )}
                    >
                      <span className="text-base leading-none">{emoji}</span>
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground">({colCount} cols)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Grid Container */}
        <div className="flex-1 overflow-auto bg-slate-50">
          <div className="container max-w-7xl mx-auto px-6 py-8">
            <SharedBuilderGrid
              columns={columns}
              rows={rows}
              representativeColumnId={representativeColumnId}
              onRepresentativeColumnChange={handleRepresentativeColumnChange}
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