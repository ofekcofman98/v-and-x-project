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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/shared/utils/cn';
import { Plus, MoreVertical, MoveRight } from 'lucide-react';

import { useBaseListsQuery } from '@/lib/client/hooks/data/use-base-lists';
import { useColumnTemplatesQuery } from '@/lib/client/hooks/data/use-column-templates';
import { useWorkbenchesQuery, useWorkbenchQuery, useCreateWorkbenchMutation } from '@/lib/client/hooks/data/use-workbenches';
import { useCreateGroupMutation, useAssignedListsQuery } from '@/lib/client/hooks/data/use-groups';
import { BaseListDetailPane } from '@/components/base-lists/BaseListDetailPane';
import { TemplateDetailPane } from '@/components/templates/TemplateDetailPane';
import { GroupDetailPane } from '@/components/groups/GroupDetailPane';
import { WorkbenchDetailPane } from '@/components/workbenches/WorkbenchDetailPane';
import { GroupTreeRoot } from '@/components/groups/GroupTree';
import { CreateContainerDialog } from '@/components/library/CreateContainerDialog';
import { MoveListDialog } from '@/components/library/MoveListDialog';
import { DynamicListCreator } from '@/components/base-lists/DynamicListCreator';
import { DynamicTemplateCreator } from '@/components/column-templates/DynamicTemplateCreator';
import { ImportCsvButton, type ParsedCsvImport } from '@/components/import/ImportCsvButton';
import { categoryIcon } from '@/components/templates/template-categories';

type LibraryTab = 'lists' | 'templates';

const ALL_LISTS_VALUE = '__all__';

function IndexItem({
  label,
  sublabel,
  icon,
  isSelected,
  onClick,
  onMoveClick,
}: {
  label: string;
  sublabel?: string;
  icon?: string;
  isSelected: boolean;
  onClick: () => void;
  /** Present only for BaseList rows — renders a "..." menu with "Move to Group/Workbench…". */
  onMoveClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'group/row flex items-center gap-1 rounded-md transition-colors',
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
      )}
    >
      <button onClick={onClick} className="flex-1 min-w-0 text-left px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span aria-hidden>{icon}</span>}
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sublabel}</p>}
      </button>
      {onMoveClick && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="More actions"
              className="shrink-0 p-1.5 mr-1 rounded-md text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground hover:bg-muted transition-opacity data-[state=open]:opacity-100"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onMoveClick}>
              <MoveRight className="h-4 w-4" />
              Move to Group/Workbench…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Owns its own Move dialog state for a flat "All Lists" row. */
function FlatListItem({
  id,
  name,
  columnCount,
  isSelected,
  onClick,
}: {
  id: string;
  name: string;
  columnCount: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [showMove, setShowMove] = useState(false);

  return (
    <>
      <IndexItem
        label={name}
        sublabel={`${columnCount} column${columnCount !== 1 ? 's' : ''}`}
        isSelected={isSelected}
        onClick={onClick}
        onMoveClick={() => setShowMove(true)}
      />
      <MoveListDialog baseListId={id} baseListName={name} open={showMove} onClose={() => setShowMove(false)} />
    </>
  );
}

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

  const listsQuery = useBaseListsQuery();
  const templatesQuery = useColumnTemplatesQuery();
  const workbenchesQuery = useWorkbenchesQuery();
  const activeWorkbenchQuery = useWorkbenchQuery(selectedWorkbenchId);
  const assignedListsQuery = useAssignedListsQuery();
  const createWorkbenchMutation = useCreateWorkbenchMutation();
  const createGroupMutation = useCreateGroupMutation();

  const lists = listsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const workbenches = workbenchesQuery.data ?? [];
  const topGroups = activeWorkbenchQuery.data?.groups ?? [];

  const assignedListIds = new Set((assignedListsQuery.data ?? []).map((a) => a.baseListId));
  const unassignedLists = lists.filter((l) => !assignedListIds.has(l.id));

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
                <>
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <Select
                      value={selectedWorkbenchId ?? ALL_LISTS_VALUE}
                      onValueChange={(value) => selectWorkbench(value === ALL_LISTS_VALUE ? null : value)}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_LISTS_VALUE}>All Lists</SelectItem>
                        {workbenches.map((wb) => (
                          <SelectItem key={wb.id} value={wb.id}>
                            {wb.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => setShowNewWorkbench(true)}
                      aria-label="New workbench"
                      className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {selectedWorkbenchId === null ? (
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
                            <FlatListItem
                              key={list.id}
                              id={list.id}
                              name={list.name}
                              columnCount={list.schema.columns.length}
                              isSelected={selectedListId === list.id}
                              onClick={() => selectList(list.id)}
                            />
                          ))}
                          {lists.length === 0 && (
                            <p className="text-xs text-muted-foreground px-3 py-2">No lists yet.</p>
                          )}
                        </div>
                      )}
                    </>
                  ) : activeWorkbenchQuery.isLoading ? (
                    <div className="space-y-2 p-2">
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ) : activeWorkbenchQuery.error ? (
                    <InlineErrorState
                      error={activeWorkbenchQuery.error.message}
                      onRetry={() => activeWorkbenchQuery.refetch()}
                    />
                  ) : (
                    <>
                      <GroupTreeRoot
                        workbenchId={selectedWorkbenchId}
                        topGroups={topGroups}
                        selection={
                          selectedGroupId
                            ? { kind: 'group', id: selectedGroupId }
                            : selectedListId
                              ? { kind: 'list', id: selectedListId }
                              : null
                        }
                        onSelectGroup={selectGroup}
                        onSelectList={selectList}
                        onCreateGroup={() => setShowNewGroup(true)}
                      />

                      {unassignedLists.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-xs font-medium text-muted-foreground px-1 mb-1">
                            Unassigned Lists
                          </p>
                          <div className="space-y-1">
                            {unassignedLists.map((list) => (
                              <FlatListItem
                                key={list.id}
                                id={list.id}
                                name={list.name}
                                columnCount={list.schema.columns.length}
                                isSelected={selectedListId === list.id}
                                onClick={() => selectList(list.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="mt-2 space-y-1">
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
                  </div>
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
