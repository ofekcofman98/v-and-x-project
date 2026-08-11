'use client';

/**
 * WorkbenchListNavigator — Workbench switcher + nested Group tree (BaseLists
 * as leaves) + an "Unassigned Lists" bucket, with a flat list fallback when
 * no Workbench is selected. Owns its own data fetching so callers only pass
 * selection state and callbacks.
 *
 * Extracted from app/dashboard/library/page.tsx's Lists tab — the workspace
 * sidebar (docs/features/16_master_detail_workspace.md §3) is the second
 * consumer, and this file is the DRY extraction point rather than a second
 * hand-rolled copy.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineErrorState } from '@/components/states/error-state';
import { IndexItem } from '@/components/library/IndexItem';
import { MoveListDialog } from '@/components/library/MoveListDialog';
import { GroupTreeRoot, type TreeSelection } from '@/components/groups/GroupTree';
import { useBaseListsQuery } from '@/lib/client/hooks/data/use-base-lists';
import { useWorkbenchesQuery, useWorkbenchQuery } from '@/lib/client/hooks/data/use-workbenches';
import { useAssignedListsQuery } from '@/lib/client/hooks/data/use-groups';

const ALL_LISTS_VALUE = '__all__';

/** Owns its own Move dialog state for a flat "All Lists" / "Unassigned" row. */
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

export interface WorkbenchListNavigatorProps {
  selectedWorkbenchId: string | null;
  onSelectWorkbenchId: (id: string | null) => void;
  selection: TreeSelection | null;
  onSelectList: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onCreateWorkbench: () => void;
  onCreateGroup: () => void;
  /** Rendered below the list/tree — e.g. "+ New list" / CSV import in Library. */
  footer?: React.ReactNode;
}

export function WorkbenchListNavigator({
  selectedWorkbenchId,
  onSelectWorkbenchId,
  selection,
  onSelectList,
  onSelectGroup,
  onCreateWorkbench,
  onCreateGroup,
  footer,
}: WorkbenchListNavigatorProps) {
  const listsQuery = useBaseListsQuery();
  const workbenchesQuery = useWorkbenchesQuery();
  const activeWorkbenchQuery = useWorkbenchQuery(selectedWorkbenchId);
  const assignedListsQuery = useAssignedListsQuery();

  const lists = listsQuery.data ?? [];
  const workbenches = workbenchesQuery.data ?? [];
  const topGroups = activeWorkbenchQuery.data?.groups ?? [];

  const assignedListIds = new Set((assignedListsQuery.data ?? []).map((a) => a.baseListId));
  const unassignedLists = lists.filter((l) => !assignedListIds.has(l.id));

  return (
    <>
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Select
          value={selectedWorkbenchId ?? ALL_LISTS_VALUE}
          onValueChange={(value) => onSelectWorkbenchId(value === ALL_LISTS_VALUE ? null : value)}
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
          onClick={onCreateWorkbench}
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
                  isSelected={selection?.kind === 'list' && selection.id === list.id}
                  onClick={() => onSelectList(list.id)}
                />
              ))}
              {lists.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No lists yet.</p>}
            </div>
          )}
        </>
      ) : activeWorkbenchQuery.isLoading ? (
        <div className="space-y-2 p-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : activeWorkbenchQuery.error ? (
        <InlineErrorState error={activeWorkbenchQuery.error.message} onRetry={() => activeWorkbenchQuery.refetch()} />
      ) : (
        <>
          <GroupTreeRoot
            workbenchId={selectedWorkbenchId}
            topGroups={topGroups}
            selection={selection}
            onSelectGroup={onSelectGroup}
            onSelectList={onSelectList}
            onCreateGroup={onCreateGroup}
          />

          {unassignedLists.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-muted-foreground px-1 mb-1">Unassigned Lists</p>
              <div className="space-y-1">
                {unassignedLists.map((list) => (
                  <FlatListItem
                    key={list.id}
                    id={list.id}
                    name={list.name}
                    columnCount={list.schema.columns.length}
                    isSelected={selection?.kind === 'list' && selection.id === list.id}
                    onClick={() => onSelectList(list.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {footer && <div className="mt-2 space-y-1">{footer}</div>}
    </>
  );
}
