/**
 * Navigation Mode Toggle
 * Inspired by docs/08_UI_COMPONENTS.md section 2.5
 */

'use client';

import { ArrowDown, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUIStore, type NavigationMode } from '@/lib/stores/ui-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

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
];

export function NavigationModeToggle() {
  const navigationMode = useUIStore((state) => state.navigationMode);
  const setNavigationMode = useUIStore((state) => state.setNavigationMode);

  return (
    <TooltipProvider>
      <div className="inline-flex rounded-full border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
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
                    'flex items-center gap-1 rounded-none px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
                    'first:rounded-l-full last:rounded-r-full',
                    isActive
                      ? 'bg-blue-500 text-white shadow text-white'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
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
