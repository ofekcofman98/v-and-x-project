'use client';

/**
 * @Mention autocomplete dropdown for the Schema Agent prompt bar.
 * Implements: docs/features/03_ai_table_agent.md §3.5
 */

import { cn } from '@/lib/shared/utils/cn';
import type { BaseListDTO } from '@/lib/shared/types/models';

interface MentionAutocompleteItem {
  id: string;
  name: string;
  columnCount: number;
}

interface MentionAutocompleteProps {
  items: MentionAutocompleteItem[];
  activeIndex: number;
  onSelect: (item: MentionAutocompleteItem) => void;
  onHoverIndex: (index: number) => void;
}

export function baseListToMentionItem(list: BaseListDTO): MentionAutocompleteItem {
  return { id: list.id, name: list.name, columnCount: list.schema?.columns?.length ?? 0 };
}

export function MentionAutocomplete({ items, activeIndex, onSelect, onHoverIndex }: MentionAutocompleteProps) {
  if (items.length === 0) {
    return (
      <div className="absolute z-20 mt-1 w-72 rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-md">
        No base lists match
      </div>
    );
  }

  return (
    <ul
      role="listbox"
      className="absolute z-20 mt-1 w-72 max-h-64 overflow-auto rounded-md border bg-popover py-1 shadow-md"
    >
      {items.map((item, index) => (
        <li key={item.id} role="option" aria-selected={index === activeIndex}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHoverIndex(index)}
            className={cn(
              'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
              index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            )}
          >
            <span className="font-medium truncate">{item.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{item.columnCount} columns</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
