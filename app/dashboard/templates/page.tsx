'use client';

/**
 * Column Templates Dashboard Page
 * Browse, create, and manage reusable column schema templates.
 * Implements: docs/features/02b_column_templates_ui.md §3.1
 */

import { useEffect, useState } from 'react';
import { useColumnTemplateStore, type ColumnTemplateDTO } from '@/lib/client/stores/column-template-store';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AppHeader } from '@/components/AppHeader';
import { DynamicTemplateCreator } from '@/components/column-templates/DynamicTemplateCreator';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, LayoutTemplate, Trash2, Globe, Lock, Zap, Search, Loader2, SlidersHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/shared/utils/cn';

// ─────────────────────────────────────────────────────────
// Category helpers
// ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { icon: string; pill: string }> = {
  education: { icon: '🎓', pill: 'bg-blue-50 text-blue-700' },
  hr:         { icon: '👔', pill: 'bg-purple-50 text-purple-700' },
  inventory:  { icon: '📦', pill: 'bg-amber-50 text-amber-700' },
  finance:    { icon: '💰', pill: 'bg-green-50 text-green-700' },
  healthcare: { icon: '🏥', pill: 'bg-red-50 text-red-700' },
  custom:     { icon: '⚙️',  pill: 'bg-gray-50 text-gray-700' },
};

function categoryIcon(category: string | null) {
  return category ? (CATEGORY_META[category]?.icon ?? '📋') : '📋';
}

function columnPillClass(category: string | null) {
  return category ? (CATEGORY_META[category]?.pill ?? 'bg-muted text-muted-foreground') : 'bg-muted text-muted-foreground';
}

const FILTER_TABS = [
  { key: 'all',        label: 'All Templates' },
  { key: 'education',  label: '🎓 Education' },
  { key: 'hr',         label: '👔 HR' },
  { key: 'inventory',  label: '📦 Inventory' },
  { key: 'finance',    label: '💰 Finance' },
  { key: 'healthcare', label: '🏥 Healthcare' },
  { key: 'custom',     label: '⚙️ Custom' },
];

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function TemplateCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-8 rounded-full mb-2" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full mt-1" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-4/5 mb-1" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-8 w-full" />
      </CardFooter>
    </Card>
  );
}

function EmptyState({ onCreateClick, hasFilter }: { onCreateClick: () => void; hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-muted p-6 mb-4">
        <LayoutTemplate className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {hasFilter ? 'No templates in this category' : 'No templates yet'}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        {hasFilter
          ? 'Try switching to "All Templates" or create a new one.'
          : 'Column templates let you reuse the same schema across multiple Base Lists, saving setup time.'}
      </p>
      {!hasFilter && (
        <Button onClick={onCreateClick}>
          <Plus className="w-4 h-4 mr-2" />
          Create Your First Template
        </Button>
      )}
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-red-50 p-6 mb-4">
        <svg
          className="h-12 w-12 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2">Failed to load templates</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">{error}</p>
      <Button onClick={onRetry}>Try Again</Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Apply-to-lists dialog
// ─────────────────────────────────────────────────────────

interface BaseListItem {
  id: string;
  name: string;
  description: string | null;
  schema: { columns: Array<{ id: string; label: string; type: string }> } | null;
}

/** Column IDs / labels that are treated as identity fields and cannot be unchecked. */
const IDENTITY_COLUMN_KEYS = new Set(['name', 'id', 'identifier', 'key']);

function isIdentityColumn(col: { id: string; label: string }): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  return IDENTITY_COLUMN_KEYS.has(norm(col.id)) || IDENTITY_COLUMN_KEYS.has(norm(col.label));
}

function ApplyToListsDialog({
  template,
  onClose,
}: {
  template: ColumnTemplateDTO | null;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const [baseLists, setBaseLists] = useState<BaseListItem[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Which list row has its column picker panel open. */
  const [expandedColumnPickerId, setExpandedColumnPickerId] = useState<string | null>(null);
  /**
   * Per-list selected column IDs. Initialized (all columns checked) the first
   * time a list is checked. Identity columns are always present and un-removable.
   */
  const [baseListColumnSelections, setBaseListColumnSelections] = useState<
    Record<string, Set<string>>
  >({});

  // Fetch + reset every time a (different) template opens the dialog
  useEffect(() => {
    if (!template) return;
    setSelectedIds(new Set());
    setSearch('');
    setListError(null);
    setAutoSync(false);
    setExpandedColumnPickerId(null);
    setBaseListColumnSelections({});

    const fetchLists = async () => {
      setIsLoadingLists(true);
      try {
        const res = await fetch('/api/base-lists');
        if (!res.ok) throw new Error('Failed to fetch base lists');
        const { data } = await res.json();
        setBaseLists(data ?? []);
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoadingLists(false);
      }
    };

    fetchLists();
  }, [template?.id]);

  const initColumnSelection = (bl: BaseListItem): Set<string> =>
    new Set((bl.schema?.columns ?? []).map((c) => c.id));

  const toggleId = (id: string) => {
    const bl = baseLists.find((b) => b.id === id);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setExpandedColumnPickerId((curr) => (curr === id ? null : curr));
      } else {
        next.add(id);
        if (bl) {
          setBaseListColumnSelections((prev) => {
            if (prev[id]) return prev;
            return { ...prev, [id]: initColumnSelection(bl) };
          });
        }
      }
      return next;
    });
  };

  const toggleColumnSelection = (baseListId: string, colId: string) => {
    setBaseListColumnSelections((prev) => {
      const current = new Set(prev[baseListId] ?? []);
      if (current.has(colId)) current.delete(colId);
      else current.add(colId);
      return { ...prev, [baseListId]: current };
    });
  };

  const filteredLists = baseLists.filter(
    (bl) => !search.trim() || bl.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const allVisibleSelected =
    filteredLists.length > 0 && filteredLists.every((bl) => selectedIds.has(bl.id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredLists.forEach((bl) => {
          next.delete(bl.id);
          setExpandedColumnPickerId((curr) => (curr === bl.id ? null : curr));
        });
      } else {
        filteredLists.forEach((bl) => {
          next.add(bl.id);
          setBaseListColumnSelections((prev) => {
            if (prev[bl.id]) return prev;
            return { ...prev, [bl.id]: initColumnSelection(bl) };
          });
        });
      }
      return next;
    });
  };

  const handleApply = async () => {
    if (!template || selectedIds.size === 0) return;

    setIsSubmitting(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    const errors: string[] = [];

    for (const baseListId of ids) {
      try {
        const res = await fetch(`/api/base-lists/${baseListId}/apply-template`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': '00000000-0000-0000-0000-000000000000',
          },
          body: JSON.stringify({
            templateId: template.id,
            autoSync,
            selectedBaseListColumnIds: Array.from(baseListColumnSelections[baseListId] ?? []),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.error ?? `HTTP ${res.status}`;
          errors.push(`${baseLists.find((bl) => bl.id === baseListId)?.name ?? baseListId}: ${msg}`);
        } else {
          successCount++;
        }
      } catch (err) {
        const listName = baseLists.find((bl) => bl.id === baseListId)?.name ?? baseListId;
        errors.push(`${listName}: ${err instanceof Error ? err.message : 'Network error'}`);
      }
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      toast({
        title: 'Template applied',
        description: `Successfully applied to ${successCount} list${successCount !== 1 ? 's' : ''}${errors.length > 0 ? ` (${errors.length} failed)` : '!'}`,
      });
    }

    if (errors.length > 0 && successCount === 0) {
      toast({
        title: 'Apply failed',
        description: errors[0],
        variant: 'destructive',
      });
    } else if (errors.length > 0) {
      toast({
        title: 'Some lists failed',
        description: errors.join('; '),
        variant: 'destructive',
      });
    }

    if (successCount > 0) {
      onClose();
    }
  };

  return (
    <Dialog open={!!template} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span aria-hidden>{categoryIcon(template?.category ?? null)}</span>
            Apply &ldquo;{template?.name}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Choose which Base Lists should receive this template&apos;s columns.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search base lists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Scrollable checklist */}
        <div className="max-h-[260px] overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
          {isLoadingLists ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))
          ) : listError ? (
            <div className="py-8 text-center text-sm text-destructive px-4">{listError}</div>
          ) : filteredLists.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {search.trim() ? 'No lists match your search.' : 'No Base Lists found.'}
            </div>
          ) : (
            filteredLists.map((bl) => {
              const cols = bl.schema?.columns ?? [];
              const colCount = cols.length;
              const isChecked = selectedIds.has(bl.id);
              const isExpanded = expandedColumnPickerId === bl.id;
              const selectedColCount = baseListColumnSelections[bl.id]?.size ?? colCount;

              return (
                <div key={bl.id} className="divide-y divide-slate-100">
                  {/* ── Row ── */}
                  <label
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors',
                      isChecked ? 'bg-primary/5' : 'hover:bg-muted/40'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleId(bl.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-primary shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{bl.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isChecked
                          ? `${selectedColCount} of ${colCount} column${colCount !== 1 ? 's' : ''} included`
                          : `${colCount} column${colCount !== 1 ? 's' : ''}${bl.description ? ` · ${bl.description}` : ''}`}
                      </p>
                    </div>

                    {/* Column picker toggle — only shown when list is checked */}
                    {isChecked && colCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setExpandedColumnPickerId(isExpanded ? null : bl.id);
                        }}
                        aria-label={isExpanded ? 'Hide column picker' : 'Configure included columns'}
                        className={cn(
                          'shrink-0 p-1.5 rounded-md transition-colors',
                          isExpanded
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </label>

                  {/* ── Column picker sub-panel ── */}
                  {isChecked && isExpanded && colCount > 0 && (
                    <div className="bg-slate-50/80 px-4 pt-2.5 pb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Select Base List Columns to Include
                      </p>
                      <div className="space-y-1">
                        {cols.map((col) => {
                          const locked = isIdentityColumn(col);
                          const colSelected =
                            baseListColumnSelections[bl.id]?.has(col.id) ?? true;

                          return (
                            <label
                              key={col.id}
                              className={cn(
                                'flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors select-none',
                                locked
                                  ? 'cursor-not-allowed'
                                  : 'cursor-pointer hover:bg-slate-100'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={colSelected}
                                disabled={locked}
                                onChange={() =>
                                  !locked && toggleColumnSelection(bl.id, col.id)
                                }
                                className="h-3.5 w-3.5 rounded border-slate-300 accent-primary shrink-0"
                              />
                              <span
                                className={cn(
                                  'text-xs font-medium flex-1 truncate',
                                  !colSelected && !locked && 'text-muted-foreground line-through'
                                )}
                              >
                                {col.label}
                              </span>
                              <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 bg-muted rounded shrink-0">
                                {col.type.toLowerCase()}
                              </span>
                              {locked && (
                                <Lock
                                  className="h-3 w-3 text-slate-400 shrink-0"
                                  aria-label="Identity column — always included"
                                />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Select-all + count summary */}
        {!isLoadingLists && !listError && filteredLists.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button
              type="button"
              onClick={toggleAll}
              className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              {allVisibleSelected ? 'Deselect all' : 'Select all'}
            </button>
            <span>
              {selectedIds.size} of {baseLists.length} list{baseLists.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        )}

        {/* ── Auto-Sync ── */}
        <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-muted/20 transition-colors select-none">
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary"
          />
          <div>
            <p className="text-sm font-medium">Enable Auto-Sync</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Future schema changes to this template will automatically update the linked lists.
            </p>
          </div>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={selectedIds.size === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : selectedIds.size === 0 ? (
              'Select Base Lists to Apply'
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Apply to {selectedIds.size} List{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────
// Template card
// ─────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onDeleteClick,
  onApplyClick,
}: {
  template: ColumnTemplateDTO;
  onDeleteClick: (id: string) => void;
  onApplyClick: (template: ColumnTemplateDTO) => void;
}) {
  const columns = template.schema?.columns ?? [];
  const visibleColumns = columns.slice(0, 5);
  const overflow = columns.length - visibleColumns.length;
  const pillClass = columnPillClass(template.category);

  return (
    <Card className="group flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5" aria-hidden>
              {categoryIcon(template.category)}
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base leading-tight">{template.name}</CardTitle>
              {template.description && (
                <CardDescription className="line-clamp-2 mt-0.5">
                  {template.description}
                </CardDescription>
              )}
            </div>
          </div>
          <button
            onClick={() => onDeleteClick(template.id)}
            aria-label={`Delete ${template.name}`}
            className="mt-0.5 shrink-0 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {/* Column pills */}
        <div className="space-y-1 mb-4">
          {visibleColumns.map((col) => (
            <div
              key={col.id}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full w-fit',
                pillClass
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
              <span className="truncate max-w-[160px]">{col.label}</span>
              <span className="opacity-60 ml-0.5 capitalize">{col.type}</span>
            </div>
          ))}
          {overflow > 0 && (
            <p className="text-xs text-muted-foreground pl-2">+{overflow} more</p>
          )}
        </div>

        {/* Footer meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-slate-100">
          <span>{columns.length} column{columns.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1">
            {template.is_public ? (
              <>
                <Globe className="h-3 w-3" />
                <span>Public</span>
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                <span>Private</span>
              </>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <span className="flex-1 text-xs text-muted-foreground">
          Used by {template.usage_count} list{template.usage_count !== 1 ? 's' : ''}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => onApplyClick(template)}
        >
          <Zap className="h-3.5 w-3.5" />
          Apply to Lists
        </Button>
      </CardFooter>

    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

export default function TemplatesDashboardPage() {
  const { templates, isLoading, error, fetchTemplates, deleteTemplate } =
    useColumnTemplateStore();
  const { toast } = useToast();

  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [applyTarget, setApplyTarget] = useState<ColumnTemplateDTO | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const pendingTemplate = templates.find((t) => t.id === pendingDeleteId);

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      // TODO: Replace x-user-id with real auth header
      const response = await fetch(`/api/column-templates/${pendingDeleteId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': '00000000-0000-0000-0000-000000000000' },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(
          Array.isArray(data.error) ? data.error.join(', ') : data.error || `HTTP ${response.status}`
        );
      }
      deleteTemplate(pendingDeleteId);
      toast({
        title: 'Template deleted',
        description: `"${pendingTemplate?.name}" was removed.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setPendingDeleteId(null);
    }
  };

  // Client-side filtering
  const filtered = templates.filter((t) => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch =
      !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          {/* Page header */}
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Column Templates</h1>
                <p className="text-muted-foreground mt-2">
                  Reusable column schemas you can inject into any Base List
                </p>
              </div>
              <Button onClick={() => setIsCreatorOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </div>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Category tabs */}
              <div className="flex items-center gap-1 flex-wrap">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveCategory(tab.key)}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap',
                      activeCategory === tab.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                type="search"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 sm:ml-auto sm:w-56"
              />
            </div>
          </div>

          {/* Content */}
          {error ? (
            <ErrorState error={error} onRetry={fetchTemplates} />
          ) : isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <TemplateCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              onCreateClick={() => setIsCreatorOpen(true)}
              hasFilter={activeCategory !== 'all' || !!search.trim()}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onDeleteClick={setPendingDeleteId}
                  onApplyClick={setApplyTarget}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <DynamicTemplateCreator
        open={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
      />

      <DeleteConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        itemName={pendingTemplate?.name || ''}
        isDeleting={isDeleting}
      />

      <ApplyToListsDialog
        template={applyTarget}
        onClose={() => setApplyTarget(null)}
      />
    </>
  );
}
