'use client';

/**
 * Library Page — master-detail Lists/Templates browser.
 * Replaces the separate Base Lists / Column Templates dashboards as primary
 * nav destinations: one page, a tab toggle, and an inline detail pane that
 * renders on click with no route change.
 * Implements: docs/features/13_ux_ia_redesign.md § Library Page
 *
 * Lists tab additionally supports the Workbench/Group hierarchy (Phase 3 of
 * docs/features/12_groups_workbenches.md §5): a Workbench switcher above the
 * index pane, and a nested Group tree (BaseLists as leaves) replacing the flat
 * list only while a Workbench is selected. With no Workbench selected ("All
 * Lists"), the index pane renders the exact same flat list as before.
 */

import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { cn } from '@/lib/shared/utils/cn';
import { Plus } from 'lucide-react';

import { useColumnTemplatesQuery } from '@/lib/client/hooks/data/use-column-templates';
import { useCreateWorkbenchMutation } from '@/lib/client/hooks/data/use-workbenches';
import { useCreateGroupMutation } from '@/lib/client/hooks/data/use-groups';
import { BaseListDetailPane } from '@/components/base-lists/BaseListDetailPane';
import { TemplateDetailPane } from '@/components/templates/TemplateDetailPane';
import { GroupDetailPane } from '@/components/groups/GroupDetailPane';
import { WorkbenchDetailPane } from '@/components/workbenches/WorkbenchDetailPane';
import { IndexItem } from '@/components/library/IndexItem';
import { WorkbenchListNavigator } from '@/components/library/WorkbenchListNavigator';
import { CreateContainerDialog } from '@/components/library/CreateContainerDialog';
import { DynamicListCreator } from '@/components/base-lists/DynamicListCreator';
import { DynamicTemplateCreator } from '@/components/column-templates/DynamicTemplateCreator';
import { ImportCsvButton, type ParsedCsvImport } from '@/components/import/ImportCsvButton';
import { categoryIcon } from '@/components/templates/template-categories';

type LibraryTab = 'lists' | 'templates';

export default function LibraryPage() {
  const [tab, setTab] = useState<LibraryTab>('lists');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedWorkbenchId, setSelectedWorkbenchId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showNewList, setShowNewList] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showNewWorkbench, setShowNewWorkbench] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  // Bumped every time the "new list" dialog is (re)opened so DynamicListCreator
  // remounts — its initialColumns/initialRows/initialName are only read once,
  // on mount, so a CSV import must force a fresh instance to seed the grid.
  const [listDialogKey, setListDialogKey] = useState(0);
  const [csvImport, setCsvImport] = useState<ParsedCsvImport | null>(null);

  const templatesQuery = useColumnTemplatesQuery();
  const createWorkbenchMutation = useCreateWorkbenchMutation();
  const createGroupMutation = useCreateGroupMutation();

  const templates = templatesQuery.data ?? [];

  const selectList = (id: string) => {
    setSelectedGroupId(null);
    setSelectedListId(id);
  };
  const selectGroup = (id: string) => {
    setSelectedListId(null);
    setSelectedGroupId(id);
  };
  const selectWorkbench = (id: string | null) => {
    setSelectedWorkbenchId(id);
    setSelectedGroupId(null);
    setSelectedListId(null);
  };

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
                <WorkbenchListNavigator
                  selectedWorkbenchId={selectedWorkbenchId}
                  onSelectWorkbenchId={selectWorkbench}
                  selection={
                    selectedGroupId
                      ? { kind: 'group', id: selectedGroupId }
                      : selectedListId
                        ? { kind: 'list', id: selectedListId }
                        : null
                  }
                  onSelectList={selectList}
                  onSelectGroup={selectGroup}
                  onCreateWorkbench={() => setShowNewWorkbench(true)}
                  onCreateGroup={() => setShowNewGroup(true)}
                  footer={
                    <>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          setCsvImport(null);
                          setListDialogKey((k) => k + 1);
                          setShowNewList(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New list
                      </Button>
                      <ImportCsvButton
                        onImported={(data) => {
                          setCsvImport(data);
                          setListDialogKey((k) => k + 1);
                          setShowNewList(true);
                        }}
                      />
                    </>
                  }
                />
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
              {tab === 'templates' ? (
                !selectedTemplateId ? (
                  <div className="flex items-center justify-center h-full min-h-[240px] border border-dashed border-slate-200 rounded-lg text-sm text-muted-foreground">
                    Select a template to view its details
                  </div>
                ) : (
                  <TemplateDetailPane
                    key={selectedTemplateId}
                    id={selectedTemplateId}
                    onDeleted={() => setSelectedTemplateId(null)}
                  />
                )
              ) : selectedListId ? (
                <BaseListDetailPane
                  key={selectedListId}
                  id={selectedListId}
                  onDeleted={() => setSelectedListId(null)}
                />
              ) : selectedGroupId ? (
                <GroupDetailPane
                  key={selectedGroupId}
                  id={selectedGroupId}
                  onDeleted={() => setSelectedGroupId(null)}
                  onSelectGroup={selectGroup}
                  onSelectList={selectList}
                />
              ) : selectedWorkbenchId ? (
                <WorkbenchDetailPane
                  key={selectedWorkbenchId}
                  id={selectedWorkbenchId}
                  onDeleted={() => selectWorkbench(null)}
                  onSelectGroup={selectGroup}
                  onSelectList={selectList}
                />
              ) : (
                <div className="flex items-center justify-center h-full min-h-[240px] border border-dashed border-slate-200 rounded-lg text-sm text-muted-foreground">
                  Select a list, group, or workbench to view its details
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <DynamicListCreator
        key={listDialogKey}
        open={showNewList}
        onClose={() => setShowNewList(false)}
        onSuccess={(id) => {
          setShowNewList(false);
          if (id) selectList(id);
        }}
        initialName={csvImport?.name}
        initialColumns={csvImport?.columns}
        initialRows={csvImport?.rows}
      />
      <DynamicTemplateCreator
        open={showNewTemplate}
        onClose={() => setShowNewTemplate(false)}
        onSuccess={(id) => {
          setShowNewTemplate(false);
          if (id) setSelectedTemplateId(id);
        }}
      />

      <CreateContainerDialog
        open={showNewWorkbench}
        title="New Workbench"
        onClose={() => setShowNewWorkbench(false)}
        onSubmit={async (name, description) => {
          const workbench = await createWorkbenchMutation.mutateAsync({ name, description });
          selectWorkbench(workbench.id);
        }}
      />
      <CreateContainerDialog
        open={showNewGroup}
        title="New Group"
        onClose={() => setShowNewGroup(false)}
        onSubmit={async (name, description) => {
          if (!selectedWorkbenchId) return;
          const group = await createGroupMutation.mutateAsync({ workbenchId: selectedWorkbenchId, name, description });
          selectGroup(group.id);
        }}
      />
    </>
  );
}
