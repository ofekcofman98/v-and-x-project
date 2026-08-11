'use client';

/**
 * WorkspaceHeader — active Base List name/description + a tab bar over the
 * Tables produced by every template applied to it (one Table === one
 * applied template, see base-list-service.ts applyTemplateToBaseList).
 * Implements: docs/features/16_master_detail_workspace.md §4
 */

import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { deriveTemplateTabLabel } from '@/lib/shared/utils/template-tab-label';
import type { BaseListTableSummary } from '@/lib/shared/types/models';

export interface WorkspaceHeaderProps {
  baseListName: string;
  baseListDescription: string | null;
  tables: BaseListTableSummary[];
  activeTableId: string | undefined;
  isLoading: boolean;
  onSelectTable: (tableId: string) => void;
}

export function WorkspaceHeader({
  baseListName,
  baseListDescription,
  tables,
  activeTableId,
  isLoading,
  onSelectTable,
}: WorkspaceHeaderProps) {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{baseListName}</h1>
        {baseListDescription && <p className="text-muted-foreground mt-1">{baseListDescription}</p>}
      </div>

      {isLoading ? (
        <Skeleton className="h-10 w-64" />
      ) : tables.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border p-4">
          <p className="text-sm text-muted-foreground flex-1">
            No templates applied to this list yet — apply one to start collecting data.
          </p>
          <Link
            href="/dashboard/library?tab=templates"
            className="shrink-0 inline-flex h-9 items-center justify-center rounded-md border-2 border-[#13501B] px-3 text-sm font-bold text-[#13501B] transition-colors hover:bg-[#f2f8f2]"
          >
            Apply a template
          </Link>
        </div>
      ) : (
        <Tabs value={activeTableId} onValueChange={onSelectTable}>
          <TabsList>
            {tables.map((table) => (
              <TabsTrigger key={table.id} value={table.id}>
                {deriveTemplateTabLabel(table.name, baseListName)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}
