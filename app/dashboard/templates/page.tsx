'use client';

/**
 * Column Templates Dashboard Page
 * Browse, create, and manage reusable column schema templates.
 * Implements: docs/features/02b_column_templates_ui.md §3.1
 */

import { useEffect, useState } from 'react';
import { useColumnTemplateStore, type ColumnTemplateDTO } from '@/lib/stores/column-template-store';
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
import { Plus, LayoutTemplate, Trash2, Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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
// Template card
// ─────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onDeleteClick,
}: {
  template: ColumnTemplateDTO;
  onDeleteClick: (id: string) => void;
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
        headers: { 'x-user-id': 'dev-user' },
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
    </>
  );
}
