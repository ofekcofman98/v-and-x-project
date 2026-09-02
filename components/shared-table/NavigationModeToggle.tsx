/**
 * Navigation Mode Toggle
 * Inspired by docs/08_UI_COMPONENTS.md section 2.5
 */

'use client';

import { ArrowDown, ArrowRight, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUIStore, type NavigationMode } from '@/lib/client/stores/ui-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/shared/utils/cn';

/**
 * 2×3 mini-grid preview matching the actual band shape each mode paints on
 * the real grid (§6) — reinforces the mental model right where the mode is
 * chosen. docs/features/15_realtime_voice_feedback.md §6.1
 */
function ModePreview({ mode, active }: { mode: NavigationMode; active: boolean }) {
  const cellColor = (row: number, col: number) => {
    const highlighted = (() => {
      switch (mode) {
        case 'column-first':
          return col === 0;
        case 'row-first':
        case 'entity-first':
          return row === 0;
        default: {
          const _exhaustive: never = mode;
          return _exhaustive;
        }
      }
    })();
    if (!highlighted) return 'rgba(255,255,255,0.35)';
    return active ? 'rgba(255,255,255,0.95)' : '#13501B';
  };

  return (
    <span
      className="grid gap-[1.5px] shrink-0"
      style={{ gridTemplateColumns: 'repeat(2, 3px)', gridTemplateRows: 'repeat(3, 3px)' }}
      aria-hidden="true"
    >
      {Array.from({ length: 3 }).map((_, row) =>
        Array.from({ length: 2 }).map((_, col) => (
          <span
            key={`${row}-${col}`}
            style={{ width: 3, height: 3, background: cellColor(row, col), borderRadius: 0.5 }}
          />
        ))
      )}
    </span>
  );
}

const MODE_OPTIONS: Array<{
  mode: NavigationMode;
  label: string;
  tooltip: string;
  Icon: LucideIcon;
}> = [
  {
    mode: 'row-first',
    label: 'Row-first',
    tooltip: 'Move right after entry',
    Icon: ArrowRight,
  },
  {
    mode: 'column-first',
    label: 'Column-first',
    tooltip: 'Move down after entry',
    Icon: ArrowDown,
  },
  {
    mode: 'entity-first',
    label: 'Entity-first',
    tooltip: 'Say a name once, then its values across columns',
    Icon: UserRound,
  },
];

export function NavigationModeToggle() {
  const navigationMode = useUIStore((state) => state.navigationMode);
  const setNavigationMode = useUIStore((state) => state.setNavigationMode);

  return (
    <TooltipProvider>
      <div className="inline-flex rounded-full border border-gray-200 bg-white shadow-sm">
        {MODE_OPTIONS.map(({ mode, label, tooltip, Icon }) => {
          const isActive = mode === navigationMode;

          return (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (!isActive) {
                      setNavigationMode(mode);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-none px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    'first:rounded-l-full last:rounded-r-full',
                    isActive ? 'text-white shadow' : 'text-gray-600 hover:bg-gray-100'
                  )}
                  style={isActive ? { background: '#13501B' } : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  <ModePreview mode={mode} active={isActive} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
