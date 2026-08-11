'use client';

/**
 * WorkspaceSidebar — Workbench switcher + nested Group tree navigator for
 * the Master-Detail Workspace. Thin URL-state wrapper around the shared
 * WorkbenchListNavigator (also used by the Library page).
 * Implements: docs/features/16_master_detail_workspace.md §3
 */

import { useState } from 'react';
import { WorkbenchListNavigator } from '@/components/library/WorkbenchListNavigator';
import { CreateContainerDialog } from '@/components/library/CreateContainerDialog';
import { useCreateWorkbenchMutation } from '@/lib/client/hooks/data/use-workbenches';
import { useCreateGroupMutation } from '@/lib/client/hooks/data/use-groups';
import type { TreeSelection } from '@/components/groups/GroupTree';

export interface WorkspaceSidebarProps {
  selectedListId: string | null;
  onSelectList: (baseListId: string) => void;
}

export function WorkspaceSidebar({ selectedListId, onSelectList }: WorkspaceSidebarProps) {
  const [selectedWorkbenchId, setSelectedWorkbenchId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showNewWorkbench, setShowNewWorkbench] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  const createWorkbenchMutation = useCreateWorkbenchMutation();
  const createGroupMutation = useCreateGroupMutation();

  const selection: TreeSelection | null = selectedListId
    ? { kind: 'list', id: selectedListId }
    : selectedGroupId
      ? { kind: 'group', id: selectedGroupId }
      : null;

  return (
    <>
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto p-3">
        <WorkbenchListNavigator
          selectedWorkbenchId={selectedWorkbenchId}
          onSelectWorkbenchId={(id) => {
            setSelectedWorkbenchId(id);
            setSelectedGroupId(null);
          }}
          selection={selection}
          onSelectList={(id) => {
            setSelectedGroupId(null);
            onSelectList(id);
          }}
          onSelectGroup={setSelectedGroupId}
          onCreateWorkbench={() => setShowNewWorkbench(true)}
          onCreateGroup={() => setShowNewGroup(true)}
        />
      </aside>

      <CreateContainerDialog
        open={showNewWorkbench}
        title="New Workbench"
        onClose={() => setShowNewWorkbench(false)}
        onSubmit={async (name, description) => {
          const workbench = await createWorkbenchMutation.mutateAsync({ name, description });
          setSelectedWorkbenchId(workbench.id);
        }}
      />
      <CreateContainerDialog
        open={showNewGroup}
        title="New Group"
        onClose={() => setShowNewGroup(false)}
        onSubmit={async (name, description) => {
          if (!selectedWorkbenchId) return;
          const group = await createGroupMutation.mutateAsync({ workbenchId: selectedWorkbenchId, name, description });
          setSelectedGroupId(group.id);
        }}
      />
    </>
  );
}
