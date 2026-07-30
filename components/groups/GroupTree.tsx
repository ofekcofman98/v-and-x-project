'use client';

/**
 * GroupTree
 * Recursive Group tree rendering for the Library page's index pane and the
 * Workbench detail pane — BaseLists render as leaves.
 * Implements: docs/features/12_groups_workbenches.md §5
 *
 * GET /api/groups/:id/tree returns the FULL recursive subtree in one call, so
 * only the top-level GroupTreeItem needs to fetch — everything below that is
 * pure client-side rendering of already-fetched data (no per-level fetching).
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Plus, MoveRight } from 'lucide-react';
import { cn } from '@/lib/shared/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupTreeQuery, type GroupTreeNode } from '@/lib/client/hooks/data/use-groups';
import { MoveGroupDialog } from '@/components/groups/MoveGroupDialog';

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
  onMoveClick,
}: {
  label: string;
  depth: number;
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  toggle?: React.ReactNode;
  /** Present only for Group rows — renders a small "Move" icon button. */
  onMoveClick?: () => void;
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
      {onMoveClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveClick();
          }}
          aria-label="Move group"
          className="shrink-0 p-1 rounded-md text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground hover:bg-muted transition-opacity"
        >
          <MoveRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Pure recursive renderer for an already-fetched GroupTreeNode — no hooks, no fetching. */
export function GroupTreeNodeView({
  node,
  depth,
  callbacks,
}: {
  node: GroupTreeNode;
  depth: number;
  callbacks: TreeCallbacks;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showMove, setShowMove] = useState(false);
  const hasChildren = node.childGroups.length > 0 || node.baseLists.length > 0;

  return (
    <div>
      <Row
        label={node.name}
        depth={depth}
        isSelected={callbacks.selection?.kind === 'group' && callbacks.selection.id === node.id}
        onClick={() => callbacks.onSelectGroup(node.id)}
        onMoveClick={() => setShowMove(true)}
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
      <MoveGroupDialog groupId={node.id} open={showMove} onClose={() => setShowMove(false)} />

      {expanded && (
        <>
          {node.childGroups.map((child) => (
            <GroupTreeNodeView key={child.id} node={child} depth={depth + 1} callbacks={callbacks} />
          ))}
          {node.baseLists.map((bl) => (
            <Row
              key={bl.id}
              label={bl.name}
              depth={depth + 1}
              isSelected={callbacks.selection?.kind === 'list' && callbacks.selection.id === bl.id}
              onClick={() => callbacks.onSelectList(bl.id)}
              icon={<FileText className="h-3.5 w-3.5" />}
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
  callbacks,
}: {
  id: string;
  name: string;
  callbacks: TreeCallbacks;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const { data: tree, isLoading } = useGroupTreeQuery(id, { enabled: expanded });

  if (expanded && tree) {
    return <GroupTreeNodeView node={tree} depth={0} callbacks={callbacks} />;
  }

  return (
    <div>
      <Row
        label={name}
        depth={0}
        isSelected={callbacks.selection?.kind === 'group' && callbacks.selection.id === id}
        onClick={() => callbacks.onSelectGroup(id)}
        onMoveClick={() => setShowMove(true)}
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
      <MoveGroupDialog groupId={id} open={showMove} onClose={() => setShowMove(false)} />
      {expanded && isLoading && (
        <div style={{ paddingLeft: '24px' }} className="py-1">
          <Skeleton className="h-6 w-2/3" />
        </div>
      )}
    </div>
  );
}

export interface GroupTreeRootProps extends TreeCallbacks {
  topGroups: Array<{ id: string; name: string }>;
  onCreateGroup: () => void;
}

export function GroupTreeRoot({ topGroups, onCreateGroup, ...callbacks }: GroupTreeRootProps) {
  return (
    <div className="space-y-0.5">
      {topGroups.length === 0 && (
        <p className="text-xs text-muted-foreground px-3 py-2">No groups yet.</p>
      )}
      {topGroups.map((group) => (
        <GroupTreeItem key={group.id} id={group.id} name={group.name} callbacks={callbacks} />
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
