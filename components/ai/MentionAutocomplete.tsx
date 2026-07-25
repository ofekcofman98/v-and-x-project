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
  // NOTE: uses literal slate/white colors instead of bg-popover/bg-accent/
  // text-muted-foreground — those theme-token classes resolve to nothing
  // under this project's Tailwind v4 setup (tokens are declared in
  // `@layer base`, not `@theme`, so no utility is ever generated for them),
  // which made the dropdown fully transparent. Same workaround already used
  // in components/ui/select.tsx for the same reason.
  if (items.length === 0) {
    return (
      <div className="absolute z-50 mt-1 w-72 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-500 shadow-xl">
        No base lists match
      </div>
    );
  }

  return (
    <ul
      role="listbox"
      className="absolute z-50 mt-1 w-72 max-h-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl"
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
              index === activeIndex ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-100'
            )}
          >
            <span className="font-medium truncate">{item.name}</span>
            <span className="text-xs text-slate-500 shrink-0">{item.columnCount} columns</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
