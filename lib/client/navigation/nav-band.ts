// lib/client/navigation/nav-band.ts
import type { NavigationMode } from '@/lib/shared/types/voice-pipeline';

export type NavBandAxis = 'row' | 'column';

/**
 * Which axis a navigation mode bands on the grid — row-first and
 * entity-first band the active row (entity-first follows row-first's band
 * rule per docs/features/18_entity_first_navigation.md §7); column-first
 * bands the active column. Single source of truth for the highlight-band
 * rule shared by DataTableCell, ComputedCell, ColumnHeaderCell, and
 * DataTable's RowIndexCell — extracted per .claude/rules/architecture.md's
 * DRY rule rather than repeating the same switch at each call site.
 */
export function getNavBandAxis(mode: NavigationMode): NavBandAxis {
  switch (mode) {
    case 'column-first':
      return 'column';
    case 'row-first':
    case 'entity-first':
      return 'row';
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
