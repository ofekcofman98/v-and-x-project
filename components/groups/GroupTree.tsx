'use client';

/**
 * GroupTree
 * Recursive Group tree rendering for the Library page's index pane and the
 * Workbench detail pane — BaseLists render as leaves.
 * Implements: docs/features/12_groups_workbenches.md §5, §9.5
 *
 * GET /api/groups/:id/tree returns the FULL recursive subtree in one call, so
 * only the top-level GroupTreeItem needs to fetch — everything below that is
 * pure client-side rendering of already-fetched data (no per-level fetching).
 */

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Plus, MoveRight, MoreVertical, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/shared/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { HeaderMenuAction } from '@/components/shared/DetailPageHeader';
import { useGroupTreeQuery, useCreateGroupMutation, type GroupTreeNode } from '@/lib/client/hooks/data/use-groups';
import { MoveGroupDialog } from '@/components/groups/MoveGroupDialog';
import { QuickAddListDialog } from '@/components/groups/QuickAddListDialog';
import { MoveListDialog } from '@/components/library/MoveListDialog';
import { CreateContainerDialog } from '@/components/library/CreateContainerDialog';

export interface TreeSelection {
  kind: 'group' | 'list';
  id: string;
}

export interface TreeCallbacks {
  selection: TreeSelection | null;
  onSelectGroup: (id: string) => void;
  onSelectList: (id: string) => void;
}

function Row({
  label,
  depth,
  isSelected,
  onClick,
  icon,
  toggle,
  menuActions,
}: {
  label: string;
  depth: number;
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  toggle?: React.ReactNode;
  menuActions?: HeaderMenuAction[];
}) {
  return (
    <div
      className={cn(
        'group/row flex items-center gap-1.5 rounded-md py-1.5 pr-2 cursor-pointer transition-colors',
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={onClick}
    >
      {toggle ?? <span className="w-4 shrink-0" />}
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="text-sm truncate flex-1">{label}</span>
      {menuActions && menuActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label="More actions"
              className="shrink-0 p-1 rounded-md text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground hover:bg-muted transition-opacity data-[state=open]:opacity-100"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {menuActions.map((action) => (
              <DropdownMenuItem key={action.label} onClick={action.onClick}>
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Owns its own Move dialog state — kept separate so `Row` stays a plain presentational component. */
function BaseListLeafRow({
  id,
  name,
  depth,
  isSelected,
  onClick,
}: {
  id: string;
  name: string;
  depth: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [showMove, setShowMove] = useState(false);

  const menuActions = useMemo<HeaderMenuAction[]>(
    () => [{ label: 'Move to Group/Workbench…', icon: <MoveRight className="h-4 w-4" />, onClick: () => setShowMove(true) }],
    [],
  );

  return (
    <>
      <Row label={name} depth={depth} isSelected={isSelected} onClick={onClick} icon={<FileText className="h-3.5 w-3.5" />} menuActions={menuActions} />
      <MoveListDialog baseListId={id} baseListName={name} open={showMove} onClose={() => setShowMove(false)} />
    </>
  );
}

/** Owns Move/New-subgroup/Add-list dialogs for one Group row. */
function useGroupRowDialogs(groupId: string, workbenchId: string) {
  const [showMove, setShowMove] = useState(false);
  const [showNewSubgroup, setShowNewSubgroup] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const createGroupMutation = useCreateGroupMutation();

  const menuActions = useMemo<HeaderMenuAction[]>(
    () => [
      { label: 'Move…', icon: <MoveRight className="h-4 w-4" />, onClick: () => setShowMove(true) },
      { label: '+ New subgroup here', icon: <FolderPlus className="h-4 w-4" />, onClick: () => setShowNewSubgroup(true) },
      { label: '+ Add existing list here', icon: <Plus className="h-4 w-4" />, onClick: () => setShowQuickAdd(true) },
    ],
    [],
  );

  const dialogs = (
    <>
      <MoveGroupDialog groupId={groupId} open={showMove} onClose={() => setShowMove(false)} />
      <QuickAddListDialog groupId={groupId} open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
      <CreateContainerDialog
        open={showNewSubgroup}
        title="New Subgroup"
        onClose={() => setShowNewSubgroup(false)}
        onSubmit={async (name, description) => {
          await createGroupMutation.mutateAsync({ workbenchId, parentGroupId: groupId, name, description });
        }}
      />
    </>
  );

  return { menuActions, dialogs };
}

/** Pure recursive renderer for an already-fetched GroupTreeNode — no data fetching, but does own its row dialogs. */
export function GroupTreeNodeView({
  node,
  depth,
  workbenchId,
  callbacks,
}: {
  node: GroupTreeNode;
  depth: number;
  workbenchId: string;
  callbacks: TreeCallbacks;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.childGroups.length > 0 || node.baseLists.length > 0;
  const { menuActions, dialogs } = useGroupRowDialogs(node.id, workbenchId);

  return (
    <div>
      <Row
        label={node.name}
        depth={depth}
        isSelected={callbacks.selection?.kind === 'group' && callbacks.selection.id === node.id}
        onClick={() => callbacks.onSelectGroup(node.id)}
        menuActions={menuActions}
        icon={
          hasChildren ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="w-3.5 inline-block" />
          )
        }
        toggle={
          hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="w-4 shrink-0 flex items-center justify-center"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )
        }
      />
      {dialogs}

      {expanded && (
        <>
          {node.childGroups.map((child) => (
            <GroupTreeNodeView key={child.id} node={child} depth={depth + 1} workbenchId={workbenchId} callbacks={callbacks} />
          ))}
          {node.baseLists.map((bl) => (
            <BaseListLeafRow
              key={bl.id}
              id={bl.id}
              name={bl.name}
              depth={depth + 1}
              isSelected={callbacks.selection?.kind === 'list' && callbacks.selection.id === bl.id}
              onClick={() => callbacks.onSelectList(bl.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}

/** Top-level Group: owns the lazy tree fetch, then hands off to the pure recursive renderer. */
function GroupTreeItem({
  id,
  name,
  workbenchId,
  callbacks,
}: {
  id: string;
  name: string;
  workbenchId: string;
  callbacks: TreeCallbacks;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: tree, isLoading } = useGroupTreeQuery(id, { enabled: expanded });
  const { menuActions, dialogs } = useGroupRowDialogs(id, workbenchId);

  if (expanded && tree) {
    return <GroupTreeNodeView node={tree} depth={0} workbenchId={workbenchId} callbacks={callbacks} />;
  }

  return (
    <div>
      <Row
        label={name}
        depth={0}
        isSelected={callbacks.selection?.kind === 'group' && callbacks.selection.id === id}
        onClick={() => callbacks.onSelectGroup(id)}
        menuActions={menuActions}
        icon={<ChevronRight className="h-3.5 w-3.5" />}
        toggle={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="w-4 shrink-0 flex items-center justify-center"
            aria-label="Expand"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        }
      />
      {dialogs}
      {expanded && isLoading && (
        <div style={{ paddingLeft: '24px' }} className="py-1">
          <Skeleton className="h-6 w-2/3" />
        </div>
      )}
    </div>
  );
}

export interface GroupTreeRootProps extends TreeCallbacks {
  workbenchId: string;
  topGroups: Array<{ id: string; name: string }>;
  onCreateGroup: () => void;
}

export function GroupTreeRoot({ workbenchId, topGroups, onCreateGroup, ...callbacks }: GroupTreeRootProps) {
  return (
    <div className="space-y-0.5">
      {topGroups.length === 0 && (
        <p className="text-xs text-muted-foreground px-3 py-2">No groups yet.</p>
      )}
      {topGroups.map((group) => (
        <GroupTreeItem key={group.id} id={group.id} name={group.name} workbenchId={workbenchId} callbacks={callbacks} />
      ))}
      <button
        type="button"
        onClick={onCreateGroup}
        className="w-full flex items-center gap-2 text-sm px-3 py-2 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
      >
        <Plus className="h-4 w-4" />
        New group
      </button>
    </div>
  );
}
