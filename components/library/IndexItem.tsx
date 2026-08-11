'use client';

/**
 * IndexItem — a single row in a master-detail index pane (Library, Workspace
 * sidebar). Extracted from app/dashboard/library/page.tsx so both surfaces
 * share one row presentation instead of duplicating it.
 */

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/shared/utils/cn';
import { MoreVertical, MoveRight } from 'lucide-react';

export function IndexItem({
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
