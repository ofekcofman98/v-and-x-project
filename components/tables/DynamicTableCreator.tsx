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
import type { ColumnFormula } from '@/lib/shared/types/formula';
import { validateGridSchema } from '@/lib/shared/utils/table-validation';
import { toColumnKey } from '@/lib/shared/utils/column-key';
import { SharedBuilderGrid } from '@/components/shared-table/SharedBuilderGrid';
import { useGridBuilder } from '@/components/shared-table/hooks/useGridBuilder';
import { BaseListSidebar } from './BaseListSidebar';
import { ColumnAccessModal } from './ColumnAccessModal';
import type { ColumnAccess } from '@/lib/shared/types/column-access';
import { Database, X } from 'lucide-react';

import { cn } from '@/lib/shared/utils/cn';
import { useColumnTemplateStore } from '@/lib/client/stores/column-template-store';
import type { TableDraft } from '@/lib/shared/types/ai';
import { draftToColumnDefs } from '@/lib/shared/utils/table-draft';
import { SchemaAgentPromptBar } from '@/components/ai/SchemaAgentPromptBar';
import { useSchemaAgentMutation } from '@/lib/client/hooks/ai/use-schema-agent';
import { DynamicListCreator } from '@/components/base-lists/DynamicListCreator';

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
  } = useGridBuilder({});

  const { templates, isLoading: templatesLoading, fetchTemplates } = useColumnTemplateStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedBaseListId, setSelectedBaseListId] = useState<string | null>(null);
  const [tableMetadata, setTableMetadata] = useState<TableMetadata>({});
  const [representativeColumnId, setRepresentativeColumnId] = useState<string | null>(null);
  const [showNewBaseList, setShowNewBaseList] = useState(false);

  const [accessModalColumnId, setAccessModalColumnId] = useState<string | null>(null);
  const accessModalColumn = columns.find((col) => col.id === accessModalColumnId) ?? null;

  /**
   * Inline AI-draft box — populates the same live canvas directly instead of
   * handing off to a separate route via sessionStorage.
   * Implements: docs/features/13_ux_ia_redesign.md § New Create-Table Flow
   */
  const schemaAgentMutation = useSchemaAgentMutation();

  const applyDraft = (draft: TableDraft) => {
    setTableName(draft.name);
    setDescription(draft.description ?? '');

    if (draft.baseListId) {
      // Injects the mentioned BaseList's locked columns/rows, then appends the AI-drafted columns after them.
      handleBaseListSelect(draft.baseListId, draftToColumnDefs(draft).columns);
    } else {
      const { columns: draftColumns, representativeColumnId: draftRepColumnId } = draftToColumnDefs(draft);
      setColumns(draftColumns);
      setRepresentativeColumnId(draftRepColumnId);
    }
  };

  useEffect(() => {
    if (schemaAgentMutation.isSuccess) {
      applyDraft(schemaAgentMutation.data.draft);
      schemaAgentMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaAgentMutation.isSuccess, schemaAgentMutation.data]);

  /**
   * When bound to a BaseList, only that BaseList's (locked) columns are
   * valid voice-matching keys — drafted/manually-added table columns are
   * never eligible representative columns.
   */
  const isBaseListBound = Boolean(tableMetadata.baseListId);
  const representativeEligibleColumns = isBaseListBound
    ? columns.filter((col) => col.metadata?.source === 'base_list')
    : columns;
  const representativeEligibleColumnIds = isBaseListBound
    ? new Set(representativeEligibleColumns.map((col) => col.id))
    : undefined;

  /**
   * Auto-select first eligible TEXT column as representative if none is
   * selected, or if the current selection is no longer eligible/text.
   */
  useEffect(() => {
    const currentRepColumn = columns.find(col => col.id === representativeColumnId);
    const isCurrentEligible = !isBaseListBound || currentRepColumn?.metadata?.source === 'base_list';

    if (!representativeColumnId || !currentRepColumn || currentRepColumn.type !== 'text' || !isCurrentEligible) {
      const firstTextColumn = representativeEligibleColumns.find(col => col.type === 'text');
      setRepresentativeColumnId(firstTextColumn?.id || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, representativeColumnId, isBaseListBound]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  /**
   * Handle Base List selection - Inject columns and rows
  */

  const handleBaseListSelect = async (baseListId: string, extraColumns: ColumnDef[] = []) => {
    try {
      const response = await fetch(`/api/base-lists/${baseListId}`);
      if (!response.ok) throw new Error('Failed to fetch base list');

      const { data: baseList } = await response.json();

      const injectedColumns: ColumnDef[] = baseList.schema.columns.map((col: { id: string; label: string; type: string; validation?: Record<string, unknown> }) => ({
        id: col.id,
        name: col.label,
        type: (col.type || 'text').toLowerCase() as ColumnDef['type'],
        metadata: {
          source: 'base_list' as const,
          baseListColumnId: col.id,
          locked: true,
        },
        validation: col.validation,
      }));

      // Preserve any active template columns after the new base_list columns
      const activeTemplateCols = columns.filter(
        (col) => col.metadata?.source === 'template'
      );
      // De-duplicate extraColumns (e.g. AI-drafted columns) against injected base-list column ids
      const occupiedIds = new Set(injectedColumns.map((col) => col.id));
      const dedupedExtraColumns = extraColumns.map((col) =>
        occupiedIds.has(col.id) ? { ...col, id: `${col.id}_ai` } : col
      );
      // De-duplicate previously-selected template columns against the same ids —
      // a template column can share the base list's slug (e.g. both "Name" -> `name`),
      // which otherwise leaves two columns with the same id/key. Any formula that
      // referenced a remapped column id must be remapped too.
      const idRemap = new Map<string, string>();
      const dedupedTemplateCols: ColumnDef[] = activeTemplateCols.map((col) => {
        if (!occupiedIds.has(col.id)) return col;
        const uniqueId = `${col.id}_tpl`;
        idRemap.set(col.id, uniqueId);
        return { ...col, id: uniqueId };
      });
      const remappedTemplateCols = dedupedTemplateCols.map((col) =>
        col.formula
          ? {
              ...col,
              formula: {
                ...col.formula,
                references: col.formula.references.map((refId) => idRemap.get(refId) ?? refId),
              },
            }
          : col
      );
      setColumns([...injectedColumns, ...dedupedExtraColumns, ...remappedTemplateCols]);

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
        (col: { id: string; label: string; type: string; validation?: Record<string, unknown>; formula?: ColumnFormula }) => ({
          id: col.id,
          name: col.label,
          type: (col.type || 'text').toLowerCase() as ColumnDef['type'],
          metadata: { source: 'template' as const, locked: false },
          validation: col.validation,
          formula: col.formula,
        })
      );

      // Strip previous template columns, then append de-duplicated new ones.
      // IDs are de-duplicated against the surviving (non-template) columns so
      // React never sees two children with the same key. Any formula that
      // referenced a column whose id got remapped must be remapped too.
      setColumns((prev) => {
        const base = prev.filter((col) => col.metadata?.source !== 'template');
        const occupiedIds = new Set(base.map((col) => col.id));

        const idRemap = new Map<string, string>();
        const dedupedTemplateColumns: ColumnDef[] = rawTemplateColumns.map(
          (col: ColumnDef) => {
            if (!occupiedIds.has(col.id)) return col;
            const uniqueId = `${col.id}_tpl`;
            idRemap.set(col.id, uniqueId);
            return { ...col, id: uniqueId };
          }
        );

        const remappedTemplateColumns = dedupedTemplateColumns.map((col) =>
          col.formula
            ? {
                ...col,
                formula: {
                  ...col.formula,
                  references: col.formula.references.map((refId) => idRemap.get(refId) ?? refId),
                },
              }
            : col
        );

        return [...base, ...remappedTemplateColumns];
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
   * Access rules for unsaved columns live only in local grid state — they're
   * bundled into the create payload on Save, not PATCHed live (the column/table don't exist yet).
   */
  const handleAccessSubmit = (access: ColumnAccess) => {
    if (!accessModalColumn) return;
    gridActions.onUpdateColumn(accessModalColumn.id, { access });
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

      // Transform columns to API format. Formula references are recorded as the
      // referenced column's client-side id while editing; translate them to the
      // column's key (the same slug the server derives from its label) since
      // that's the only stable identifier both sides can agree on before the
      // referenced column has a real database id.
      const columnById = new Map(columns.map((col) => [col.id, col]));
      const apiColumns = columns
      .filter((col) => col.metadata?.source !== 'base_list')
      .map((col) => ({
        label: col.name,
        type: col.type.toUpperCase() as 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'COMPUTED',
        // Template-sourced columns carry validation rules (required/min/max/pattern)
        // that must survive into the saved table's column schema.
        validation: col.validation ?? undefined,
        access: col.access ?? undefined,
        formula: col.formula
          ? {
              ...col.formula,
              references: col.formula.references.map(
                (refId) => toColumnKey(columnById.get(refId)?.name ?? refId)
              ),
            }
          : undefined,
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
    <div className="flex flex-col w-full h-[calc(100vh-3.5rem)] bg-background">
      {/* Compact single-row header: title/description + base-list badge — sits
          above BOTH the sidebar and the grid so the two share one height
          below it, instead of the sidebar stretching the full page while the
          grid is squeezed under a tall form. */}
      <div className="h-16 shrink-0 border-b border-border/50 flex items-center gap-4 px-4">
        <Input
          name="tableName"
          placeholder="Untitled table"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          className="h-9 max-w-xs border-none bg-muted/40 font-medium focus-visible:ring-1"
        />
        <Input
          name="description"
          placeholder="Add a description…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-9 flex-1 border-none bg-transparent text-muted-foreground focus-visible:ring-1 focus-visible:bg-muted/40"
        />
        {tableMetadata.baseListName && (
          <div className="shrink-0 text-sm text-muted-foreground flex items-center gap-2 whitespace-nowrap">
            <Database className="h-4 w-4" />
            <strong className="text-foreground">{tableMetadata.baseListName}</strong>
            <Button variant="ghost" size="sm" onClick={clearBaseList}>
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — height-matched to the grid section via the shared flex row above */}
        <div className="w-72 shrink-0 border-r border-border/50 flex flex-col">
          <BaseListSidebar
            selectedId={selectedBaseListId}
            onSelect={handleBaseListSelect}
            onCreateNew={() => setShowNewBaseList(true)}
          />
        </div>

        {/* Main Grid Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
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

        {/* Grid Container — bottom padding clears the floating AI dock so the
            last rows/"Add Row" control are never hidden behind it. */}
        <div className="flex-1 overflow-auto bg-muted/20">
          <div className="container max-w-7xl mx-auto px-6 py-8 pb-64">
            <SharedBuilderGrid
              columns={columns}
              rows={rows}
              representativeColumnId={representativeColumnId}
              onRepresentativeColumnChange={handleRepresentativeColumnChange}
              representativeEligibleColumnIds={representativeEligibleColumnIds}
              onAccessClick={setAccessModalColumnId}
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

      {accessModalColumn && (
        <ColumnAccessModal
          columnLabel={accessModalColumn.name}
          access={accessModalColumn.access}
          open={accessModalColumnId !== null}
          onOpenChange={(open) => !open && setAccessModalColumnId(null)}
          onSubmit={handleAccessSubmit}
        />
      )}

      <DynamicListCreator
        open={showNewBaseList}
        onClose={() => setShowNewBaseList(false)}
        onSuccess={(id) => {
          setShowNewBaseList(false);
          if (id) handleBaseListSelect(id);
        }}
      />

      {/* Floating AI Command Dock — replaces the old static AI-draft card that
          used to sit at the top and crowd the grid. */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        <div className="backdrop-blur-md bg-background/80 shadow-2xl border border-border/50 rounded-2xl p-4">
          <SchemaAgentPromptBar
            onSubmit={(request) => schemaAgentMutation.mutate(request)}
            isLoading={schemaAgentMutation.isPending}
            error={schemaAgentMutation.isError ? schemaAgentMutation.error : null}
            onRetry={() => {
              if (schemaAgentMutation.variables) schemaAgentMutation.mutate(schemaAgentMutation.variables);
            }}
          />
        </div>
      </div>
    </div>
  );
}