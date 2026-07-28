'use client';

/**
 * BaseListSidebar - Sidebar for selecting Base Lists in Table Creator
 * Implements: docs/logs/REFACTOR_TABLE_CREATOR.md §2.2
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database, Search } from 'lucide-react';
import { useBaseListsQuery } from '@/lib/client/hooks/data/use-base-lists';

interface BaseListSidebarProps {
  selectedId: string | null;
  onSelect: (baseListId: string) => void;
  onCreateNew: () => void;
}

export function BaseListSidebar({ selectedId, onSelect, onCreateNew }: BaseListSidebarProps) {
  const { data: lists = [], isLoading } = useBaseListsQuery();
  const [search, setSearch] = useState('');

  const filtered = lists.filter((list) =>
    list.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-3">Select Base List</h3>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No base lists found
            </div>
          ) : (
            filtered.map((list) => (
              <Button
                key={list.id}
                variant={selectedId === list.id ? 'default' : 'ghost'}
                className="w-full justify-start h-auto py-3 px-3"
                onClick={() => onSelect(list.id)}
              >
                <div className="flex items-start gap-3 w-full">
                  <Database className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 text-left space-y-1">
                    <div className="font-medium text-sm">{list.name}</div>
                    {list.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {list.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {list.schema.columns.length || 0} columns
                    </div>
                  </div>
                </div>
              </Button>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button variant="outline" className="w-full" size="sm" onClick={onCreateNew}>
          Create New Base List
        </Button>
      </div>
    </div>
  );
}
