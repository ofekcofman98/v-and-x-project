'use client';

/**
 * Library Page — master-detail Lists/Templates browser.
 * Replaces the separate Base Lists / Column Templates dashboards as primary
 * nav destinations: one page, a tab toggle, and an inline detail pane that
 * renders on click with no route change.
 * Implements: docs/features/13_ux_ia_redesign.md § Library Page
 */

import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { cn } from '@/lib/shared/utils/cn';
import { Plus } from 'lucide-react';

import { useBaseListsQuery } from '@/lib/client/hooks/data/use-base-lists';
import { useColumnTemplatesQuery } from '@/lib/client/hooks/data/use-column-templates';
import { BaseListDetailPane } from '@/components/base-lists/BaseListDetailPane';
import { TemplateDetailPane } from '@/components/templates/TemplateDetailPane';
import { DynamicListCreator } from '@/components/base-lists/DynamicListCreator';
import { DynamicTemplateCreator } from '@/components/column-templates/DynamicTemplateCreator';
import { categoryIcon } from '@/components/templates/template-categories';

type LibraryTab = 'lists' | 'templates';

function IndexItem({
  label,
  sublabel,
  icon,
  isSelected,
  onClick,
}: {
  label: string;
  sublabel?: string;
  icon?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-md transition-colors',
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span aria-hidden>{icon}</span>}
        <span className="text-sm font-medium truncate">{label}</span>
      </div>
      {sublabel && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sublabel}</p>}
    </button>
  );
}

export default function LibraryPage() {
  const [tab, setTab] = useState<LibraryTab>('lists');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showNewList, setShowNewList] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  const listsQuery = useBaseListsQuery();
  const templatesQuery = useColumnTemplatesQuery();

  const lists = listsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  const selectedId = tab === 'lists' ? selectedListId : selectedTemplateId;
  const setSelectedId = tab === 'lists' ? setSelectedListId : setSelectedTemplateId;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Library</h1>
              <p className="text-muted-foreground mt-2">
                Your saved Base Lists and Column Templates in one place
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
              <button
                onClick={() => setTab('lists')}
                className={cn(
                  'text-sm px-3 py-1.5 rounded-md transition-colors',
                  tab === 'lists' ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                Lists
              </button>
              <button
                onClick={() => setTab('templates')}
                className={cn(
                  'text-sm px-3 py-1.5 rounded-md transition-colors',
                  tab === 'templates' ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                Templates
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
            {/* Left index pane */}
            <div className="border border-slate-200 rounded-lg p-2 h-fit md:sticky md:top-20">
              {tab === 'lists' ? (
                <>
                  {listsQuery.isLoading ? (
                    <div className="space-y-2 p-2">
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ) : listsQuery.error ? (
                    <InlineErrorState error={listsQuery.error.message} onRetry={() => listsQuery.refetch()} />
                  ) : (
                    <div className="space-y-1">
                      {lists.map((list) => (
                        <IndexItem
                          key={list.id}
                          label={list.name}
                          sublabel={`${list.schema.columns.length} column${list.schema.columns.length !== 1 ? 's' : ''}`}
                          isSelected={selectedListId === list.id}
                          onClick={() => setSelectedListId(list.id)}
                        />
                      ))}
                      {lists.length === 0 && (
                        <p className="text-xs text-muted-foreground px-3 py-2">No lists yet.</p>
                      )}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start mt-2"
                    onClick={() => setShowNewList(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New list
                  </Button>
                </>
              ) : (
                <>
                  {templatesQuery.isLoading ? (
                    <div className="space-y-2 p-2">
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ) : templatesQuery.error ? (
                    <InlineErrorState
                      error={templatesQuery.error.message}
                      onRetry={() => templatesQuery.refetch()}
                    />
                  ) : (
                    <div className="space-y-1">
                      {templates.map((template) => (
                        <IndexItem
                          key={template.id}
                          label={template.name}
                          icon={categoryIcon(template.category)}
                          sublabel={`${template.schema?.columns.length ?? 0} column${(template.schema?.columns.length ?? 0) !== 1 ? 's' : ''}`}
                          isSelected={selectedTemplateId === template.id}
                          onClick={() => setSelectedTemplateId(template.id)}
                        />
                      ))}
                      {templates.length === 0 && (
                        <p className="text-xs text-muted-foreground px-3 py-2">No templates yet.</p>
                      )}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start mt-2"
                    onClick={() => setShowNewTemplate(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New template
                  </Button>
                </>
              )}
            </div>

            {/* Right detail pane */}
            <div className="min-w-0">
              {!selectedId ? (
                <div className="flex items-center justify-center h-full min-h-[240px] border border-dashed border-slate-200 rounded-lg text-sm text-muted-foreground">
                  Select {tab === 'lists' ? 'a list' : 'a template'} to view its details
                </div>
              ) : tab === 'lists' ? (
                <BaseListDetailPane
                  key={selectedId}
                  id={selectedId}
                  onDeleted={() => setSelectedListId(null)}
                />
              ) : (
                <TemplateDetailPane
                  key={selectedId}
                  id={selectedId}
                  onDeleted={() => setSelectedTemplateId(null)}
                />
              )}
            </div>
          </div>
        </section>
      </main>

      <DynamicListCreator
        open={showNewList}
        onClose={() => setShowNewList(false)}
        onSuccess={(id) => {
          setShowNewList(false);
          if (id) setSelectedListId(id);
        }}
      />
      <DynamicTemplateCreator
        open={showNewTemplate}
        onClose={() => setShowNewTemplate(false)}
        onSuccess={(id) => {
          setShowNewTemplate(false);
          if (id) setSelectedTemplateId(id);
        }}
      />
    </>
  );
}
