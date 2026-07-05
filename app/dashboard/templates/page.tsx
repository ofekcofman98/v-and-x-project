'use client';

/**
 * Column Templates Dashboard Page
 * Browse, create, and manage reusable column schema templates.
 * Implements: docs/features/02b_column_templates_ui.md §3.1
 */

import { useEffect, useState } from 'react';
import { useColumnTemplateStore, type ColumnTemplateDTO } from '@/lib/client/stores/column-template-store';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/AppHeader';
import { DynamicTemplateCreator } from '@/components/column-templates/DynamicTemplateCreator';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { InlineErrorState } from '@/components/states/error-state';
import { useToast } from '@/components/ui/use-toast';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/shared/utils/cn';

import { FILTER_TABS } from '@/components/templates/template-categories';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplateCardSkeleton } from '@/components/templates/TemplateCardSkeleton';
import { TemplatesEmptyState } from '@/components/templates/TemplatesEmptyState';
import { ApplyTemplateDialog } from '@/components/templates/ApplyTemplateDialog';

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

  const filtered = templates.filter((t) => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch =
      !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  const hasFilter = activeCategory !== 'all' || !!search.trim();

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
            <InlineErrorState error={error} onRetry={fetchTemplates} />
          ) : isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <TemplateCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <TemplatesEmptyState
              onCreateClick={() => setIsCreatorOpen(true)}
              hasFilter={hasFilter}
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

      <ApplyTemplateDialog
        template={applyTarget}
        onClose={() => setApplyTarget(null)}
      />
    </>
  );
}
