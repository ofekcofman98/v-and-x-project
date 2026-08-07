/**
 * VoiceEntrySurface
 * Groups VoiceButton with the confirmation UI its recording states depend
 * on — ConfirmationDialog (single-entry ambiguous/low-confidence results)
 * and BatchConfirmationStrip (multi-entity batch results). Both listen for
 * `recordingState: 'confirming'` on the shared UI store; mounting the
 * button without them leaves that state with no way to resolve.
 * Extracted at second use site (TableGridSection + demo table page) per
 * the project's DRY rule.
 * Based on: docs/features/03_ai_table_agent.md §5.5
 */

'use client';

import { VoiceButton } from '@/components/voice/VoiceButton';
import { ConfirmationDialog } from '@/components/voice/ConfirmationDialog';
import { BatchConfirmationStrip } from '@/components/voice/BatchConfirmationStrip';
import type { TableSchema } from '@/lib/shared/types/table-schema';

interface VoiceEntrySurfaceProps {
  tableId: string;
  tableSchema: TableSchema;
  layout?: 'stacked' | 'inline';
}

export function VoiceEntrySurface({
  tableId,
  tableSchema,
  layout,
}: VoiceEntrySurfaceProps): React.JSX.Element {
  return (
    <>
      <VoiceButton tableId={tableId} tableSchema={tableSchema} layout={layout} />
      <ConfirmationDialog />
      <BatchConfirmationStrip tableId={tableId} tableSchema={tableSchema} />
    </>
  );
}
