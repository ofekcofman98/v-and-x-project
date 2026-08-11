'use client';

/**
 * Workspace Layout — persistent AppHeader + sidebar shell for the
 * Master-Detail Workspace. Only app/dashboard/workspace/page.tsx's content
 * (driven by ?list=&table=) changes between navigations within this route;
 * the sidebar and header never remount.
 * Implements: docs/features/16_master_detail_workspace.md §3
 */

import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { WorkspaceSidebar } from '@/components/workspace/WorkspaceSidebar';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedListId = searchParams.get('list');

  const handleSelectList = (baseListId: string) => {
    router.replace(`/dashboard/workspace?list=${baseListId}`, { scroll: false });
  };

  return (
    <>
      <AppHeader />
      <div className="flex flex-1">
        <WorkspaceSidebar selectedListId={selectedListId} onSelectList={handleSelectList} />
        <main className="flex-1 min-w-0 container py-6">{children}</main>
      </div>
    </>
  );
}
