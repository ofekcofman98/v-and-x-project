'use client';

/**
 * DynamicTemplateCreator - Full-screen schema builder for Column Templates
 * Mirrors DynamicListCreator layout and interaction patterns.
 * Implements: docs/features/02b_column_templates_ui.md §3.1
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useColumnTemplateStore } from '@/lib/stores/column-template-store';
import type { ColumnDef } from '@/components/shared-table/types';
import { validateGridSchema } from '@/lib/utils/table-validation';
import { SharedBuilderGrid } from '@/components/shared-table/SharedBuilderGrid';
import { useGridBuilder } from '@/components/shared-table/hooks/useGridBuilder';
import { cn } from '@/lib/utils/cn';
import { ArrowLeft, Save, X, Globe, Lock } from 'lucide-react';

interface DynamicTemplateCreatorProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DEFAULT_COLUMN: ColumnDef = {
  id: 'name',
  name: 'Name',
  type: 'text',
  metadata: {
    source: 'user_defined',
    locked: false,
  },
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'No category' },
  { value: 'education', label: '🎓 Education' },
  { value: 'hr', label: '👔 HR' },
  { value: 'inventory', label: '📦 Inventory' },
  { value: 'finance', label: '💰 Finance' },
  { value: 'healthcare', label: '🏥 Healthcare' },
  { value: 'custom', label: '⚙️ Custom' },
];

export function DynamicTemplateCreator({
  open,
  onClose,
  onSuccess,
}: DynamicTemplateCreatorProps) {
  const { toast } = useToast();
  const { addTemplate } = useColumnTemplateStore();

  const {
    state: { name: templateName, description, isSubmitting, columns, rows },
    setters: { setName: setTemplateName, setDescription, setIsSubmitting, setColumns, setRows },
    gridActions,
  } = useGridBuilder(DEFAULT_COLUMN);

  const [representativeColumnId, setRepresentativeColumnId] = useState<string | null>(
    DEFAULT_COLUMN.id
  );
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    const validationError = validateGridSchema(templateName, columns, 'Template name');
    if (validationError) {
      toast({ title: 'Validation Error', description: validationError, variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: templateName,
        description: description || undefined,
        category: category || undefined,
        schema: {
          columns: columns.map((col) => ({
            id: col.id,
            label: col.name,
            type: col.type, // lowercase: "text" | "number" | "date" | "boolean"
            validation: {},
          })),
        },
        is_public: isPublic,
      };

      // TODO: Replace x-user-id with real auth header
      const response = await fetch('/api/column-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': '00000000-0000-0000-0000-000000000000',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to create template' }));
        throw new Error(
          Array.isArray(errorData.error)
            ? errorData.error.join(', ')
            : errorData.error || 'Failed to create template'
        );
      }

      const { data } = await response.json();

      addTemplate({
        id: data.id,
        name: data.name,
        description: description || null,
        category: category || null,
        is_public: isPublic,
        usage_count: 0,
        created_at: data.created_at,
      });

      toast({ title: 'Template saved', description: `"${templateName}" is ready to use.` });
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

  const handleClose = () => {
    setTemplateName('');
    setDescription('');
    setColumns([DEFAULT_COLUMN]);
    setRows([{ id: 'row_1', values: {}, metadata: { source: 'inline' } }]);
    setCategory('');
    setIsPublic(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Top Bar — mirrors DynamicListCreator */}
      <div className="border-b border-slate-200 bg-white">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: back + name + description */}
            <div className="flex items-center gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col gap-1 min-w-0">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Untitled Template"
                  className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-slate-300"
                  style={{ width: templateName ? `${templateName.length + 2}ch` : '16ch' }}
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

            {/* Right: category + public toggle + actions */}
            <div className="flex items-center gap-4 shrink-0">
              {/* Category picker */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Public toggle */}
              <button
                type="button"
                onClick={() => setIsPublic((prev) => !prev)}
                className={cn(
                  'flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-colors',
                  isPublic
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                )}
                aria-pressed={isPublic}
              >
                {isPublic ? (
                  <Globe className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {isPublic ? 'Public' : 'Private'}
              </button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleClose} className="h-9">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSubmitting} className="h-9">
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid area */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="container max-w-7xl mx-auto px-6 py-8">
          <p className="text-xs text-muted-foreground mb-4">
            Define the columns this template will provide. Sample rows below are for preview
            only and will not be saved.
          </p>
          <SharedBuilderGrid
            columns={columns}
            rows={rows}
            representativeColumnId={representativeColumnId}
            onRepresentativeColumnChange={setRepresentativeColumnId}
            {...gridActions}
          />
        </div>
      </div>
    </div>
  );
}
