/**
 * VoiceButton Shell
 * Derives a single boolean from the store and passes it down to the memoized inner component.
 * The selector `activeCell !== null` only fires when a cell is selected for the first time
 * or deselected entirely — never on row-to-row navigation — so VoiceButtonInner is
 * completely immune to cell-selection re-renders.
 * Based on: docs/05_VOICE_PIPELINE.md §2.2 and docs/06_SMART_POINTER.md §9
 */

'use client';

import { useUIStore } from '@/lib/client/stores/ui-store';
import { VoiceButtonInner } from '@/components/voice/VoiceButtonInner';
import type { TableSchema } from '@/lib/shared/types/table-schema';

interface VoiceButtonProps {
  tableId: string;
  tableSchema: TableSchema;
  layout?: 'stacked' | 'inline';
}

export function VoiceButton({ tableId, tableSchema, layout }: VoiceButtonProps): React.JSX.Element {
  const hasActiveCell = useUIStore((s) => s.activeCell !== null);

  return (
    <VoiceButtonInner
      tableId={tableId}
      tableSchema={tableSchema}
      hasActiveCell={hasActiveCell}
      layout={layout}
    />
  );
}
