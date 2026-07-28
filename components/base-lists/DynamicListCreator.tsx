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
import { useBaseListStore } from '@/lib/client/stores/base-list-store';
import type { ColumnDef, RowData } from '@/components/shared-table/types';
import { validateGridSchema } from '@/lib/shared/utils/table-validation';
import { SharedBuilderGrid } from '@/components/shared-table/SharedBuilderGrid';
import { useGridBuilder } from '@/components/shared-table/hooks/useGridBuilder';
import { ColumnAccessModal } from '@/components/tables/ColumnAccessModal';
import type { ColumnAccess } from '@/lib/shared/types/column-access';
import { Save, X, ArrowLeft } from 'lucide-react';

/**
 * Component Props
 */
interface DynamicListCreatorProps {
  open: boolean;
  onClose: () => void;
  /** Receives the newly-created list's id, e.g. so a caller can auto-select it. */
  onSuccess?: (id?: string) => void;
  /** Allow adding/removing rows. Defaults to true. */
  allowRows?: boolean;
  /** Allow cell data entry. Defaults to true. */
  allowDataEntry?: boolean;
  /** Pre-seed the grid (e.g. from a CSV import) instead of starting from DEFAULT_COLUMN. */
  initialColumns?: ColumnDef[];
  initialRows?: RowData[];
  initialName?: string;
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

export function DynamicListCreator({
  open,
  onClose,
  onSuccess,
  allowRows = true,
  allowDataEntry = true,
  initialColumns,
  initialRows,
  initialName,
}: DynamicListCreatorProps) {
  const { toast } = useToast();
  const { fetchLists } = useBaseListStore();

  const {
    state: { name: listName, description, isSubmitting, columns, rows },
    setters: { setName: setListName, setDescription, setIsSubmitting, setColumns, setRows },
    gridActions
  } = useGridBuilder({
    initialColumns: initialColumns ?? [DEFAULT_COLUMN],
    initialRows,
    initialName,
  });

  const [representativeColumnId, setRepresentativeColumnId] = useState<string | null>(
    (initialColumns ?? [DEFAULT_COLUMN])[0]?.id ?? null
  );
  const [accessModalColumnId, setAccessModalColumnId] = useState<string | null>(null);
  const accessModalColumn = columns.find((col) => col.id === accessModalColumnId) ?? null;

  if (!open) return null;

  const handleAccessSubmit = (access: ColumnAccess) => {
    if (!accessModalColumn) return;
    gridActions.onUpdateColumn(accessModalColumn.id, { access });
  };

  /**
   * Handle save - Transform to API format and submit
   */
  const handleSave = async () => {
    const validationError = validateGridSchema(listName, columns);
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
            type: col.type.toUpperCase(),
            validation: col.id === 'name' ? { required: true } : {},
            access: col.access ?? undefined,
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

      const { data } = await response.json();

      toast({
        title: 'Success',
        description: 'List created successfully',
      });

      await fetchLists();
      handleClose();
      onSuccess?.(data?.id);
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
    setListName(initialName ?? '');
    setDescription('');
    setColumns(initialColumns ?? [DEFAULT_COLUMN]);
    setRows(initialRows ?? [{ id: 'row_1', values: {}, metadata: { source: 'inline' } }]);
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
              <Button variant="ghost" onClick={handleClose} className="h-9">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSubmitting} className="h-9">
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save List'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="container max-w-7xl mx-auto px-6 py-8">
          <SharedBuilderGrid
            columns={columns}
            rows={rows}
            representativeColumnId={representativeColumnId}
            onRepresentativeColumnChange={setRepresentativeColumnId}
            allowRows={allowRows}
            allowDataEntry={allowDataEntry}
            onAccessClick={setAccessModalColumnId}
            {...gridActions}
          />
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
    </div>
  );
}