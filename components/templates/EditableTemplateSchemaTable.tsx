'use client';

/**
 * Editable Column Schema Table — Templates detail pane
 * Upgrades the read-only TemplateSchemaSection into an editable table
 * (label, type, delete row, add column) for the Library page's Templates tab.
 * Implements: docs/features/13_ux_ia_redesign.md § Library Page › Detail pane — Templates tab
 */

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Save } from 'lucide-react';

export interface EditableTemplateColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  validation?: Record<string, unknown>;
}

const COLUMN_TYPES: EditableTemplateColumn['type'][] = ['text', 'number', 'date', 'boolean'];

function makeColumnId() {
  return `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface EditableTemplateSchemaTableProps {
  columns: EditableTemplateColumn[];
  onSave: (columns: EditableTemplateColumn[]) => void | Promise<void>;
  isSaving?: boolean;
}

export function EditableTemplateSchemaTable({ columns, onSave, isSaving }: EditableTemplateSchemaTableProps) {
  const [draft, setDraft] = useState<EditableTemplateColumn[]>(columns);
  const [dirty, setDirty] = useState(false);

  const updateColumn = (id: string, patch: Partial<EditableTemplateColumn>) => {
    setDraft((prev) => prev.map((col) => (col.id === id ? { ...col, ...patch } : col)));
    setDirty(true);
  };

  const removeColumn = (id: string) => {
    setDraft((prev) => prev.filter((col) => col.id !== id));
    setDirty(true);
  };

  const addColumn = () => {
    setDraft((prev) => [...prev, { id: makeColumnId(), label: '', type: 'text' }]);
    setDirty(true);
  };

  const handleSave = async () => {
    await onSave(draft);
    setDirty(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Column Schema</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addColumn}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add column
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || draft.length === 0 || isSaving}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {draft.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground text-center">
            No columns defined. Add at least one column before saving.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.map((col) => (
                <TableRow key={col.id}>
                  <TableCell>
                    <Input
                      value={col.label}
                      onChange={(e) => updateColumn(col.id, { label: e.target.value })}
                      placeholder="Column label"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      value={col.type}
                      onChange={(e) => updateColumn(col.id, { type: e.target.value as EditableTemplateColumn['type'] })}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {COLUMN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => removeColumn(col.id)}
                      aria-label={`Delete column ${col.label || col.id}`}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
