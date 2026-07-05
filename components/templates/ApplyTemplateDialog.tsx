'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Lock, Loader2, Search, SlidersHorizontal, Zap } from 'lucide-react';
import { cn } from '@/lib/shared/utils/cn';
import type { ColumnTemplateDTO } from '@/lib/client/stores/column-template-store';
import type { BaseListSummaryDTO } from '@/lib/shared/types/models';
import { categoryIcon } from './template-categories';

interface ApplyTemplateDialogProps {
  /** The template to apply. Pass `null` to close the dialog. */
  template: ColumnTemplateDTO | null;
  onClose: () => void;
}

/** Column IDs / labels treated as identity fields that cannot be unchecked. */
const IDENTITY_COLUMN_KEYS = new Set(['name', 'id', 'identifier', 'key']);

function isIdentityColumn(col: { id: string; label: string }): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  return IDENTITY_COLUMN_KEYS.has(norm(col.id)) || IDENTITY_COLUMN_KEYS.has(norm(col.label));
}

function initColumnSelection(bl: BaseListSummaryDTO): Set<string> {
  return new Set((bl.schema?.columns ?? []).map((c) => c.id));
}

export function ApplyTemplateDialog({ template, onClose }: ApplyTemplateDialogProps) {
  const { toast } = useToast();

  const [baseLists, setBaseLists] = useState<BaseListSummaryDTO[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Which list row has its column picker panel open. */
  const [expandedColumnPickerId, setExpandedColumnPickerId] = useState<string | null>(null);
  /**
   * Per-list selected column IDs. Initialised (all columns checked) the first
   * time a list is checked. Identity columns are always present and un-removable.
   */
  const [baseListColumnSelections, setBaseListColumnSelections] = useState<
    Record<string, Set<string>>
  >({});

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
        const { data } = (await res.json()) as { data: BaseListSummaryDTO[] };
        setBaseLists(data ?? []);
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoadingLists(false);
      }
    };

    fetchLists();
  }, [template?.id]);

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
          setBaseListColumnSelections((prevSel) => {
            if (prevSel[id]) return prevSel;
            return { ...prevSel, [id]: initColumnSelection(bl) };
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
          setBaseListColumnSelections((prevSel) => {
            if (prevSel[bl.id]) return prevSel;
            return { ...prevSel, [bl.id]: initColumnSelection(bl) };
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
            // TODO: Replace with real auth header once session is wired up
            'x-user-id': '00000000-0000-0000-0000-000000000000',
          },
          body: JSON.stringify({
            templateId: template.id,
            autoSync,
            selectedBaseListColumnIds: Array.from(baseListColumnSelections[baseListId] ?? []),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
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
      toast({ title: 'Apply failed', description: errors[0], variant: 'destructive' });
    } else if (errors.length > 0) {
      toast({ title: 'Some lists failed', description: errors.join('; '), variant: 'destructive' });
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
                                locked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={colSelected}
                                disabled={locked}
                                onChange={() => !locked && toggleColumnSelection(bl.id, col.id)}
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
          <Button onClick={handleApply} disabled={selectedIds.size === 0 || isSubmitting}>
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
