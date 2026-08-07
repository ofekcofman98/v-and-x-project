'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from './DataTable';
import { NavigationModeToggle } from './NavigationModeToggle';
import { EmptyEntitiesState } from '@/components/states/empty-state';
import { VoiceEntrySurface } from '@/components/voice/VoiceEntrySurface';
import type { ColumnDefinition, RowDefinition, TableSchema } from '@/lib/shared/types/table-schema';

interface TableGridSectionProps {
  /** Required for editable (Table) views; omit when isReadOnly is true. */
  tableId?: string;
  columns: ColumnDefinition[];
  rows: RowDefinition[];
  hasData: boolean;
  totalRows: number;
  /** Override the card title. Defaults to "Data Grid". */
  title?: string;
  /** Override the card description. Defaults to the Table-specific blurb. */
  description?: string;
  /**
   * When true, passes isReadOnly down to DataTable:
   * skips cell fetching and disables all write interactions.
   * Use for BaseList detail pages where there are no table_cells.
   */
  isReadOnly?: boolean;
}

export function TableGridSection({
  tableId,
  columns,
  rows,
  hasData,
  totalRows,
  title = 'Data Grid',
  description,
  isReadOnly = false,
}: TableGridSectionProps) {
  const resolvedDescription =
    description ??
    `Integrated view combining Base List entities and Table data columns${hasData ? ` (${totalRows} ${totalRows === 1 ? 'row' : 'rows'})` : ''}`;

  const tableSchema = useMemo<TableSchema>(() => ({ columns, rows }), [columns, rows]);
  const showVoiceButton = !isReadOnly && hasData && !!tableId;

  return (
    <Card>
      <CardHeader className={isReadOnly ? undefined : 'flex flex-row items-start justify-between gap-4'}>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{resolvedDescription}</CardDescription>
        </div>
        {!isReadOnly && hasData && <NavigationModeToggle />}
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyEntitiesState
            title="No Data Yet"
            description="This table doesn't have any entities or columns yet. Add a Base List or create columns to get started."
          />
        ) : (
          <DataTable
            tableId={tableId}
            columns={columns}
            rows={rows}
            isReadOnly={isReadOnly}
          />
        )}
        {showVoiceButton && (
          <div className="mt-6 pt-4 border-t border-border/50">
            {/* tableId is guaranteed defined here: showVoiceButton requires !!tableId */}
            <VoiceEntrySurface tableId={tableId as string} tableSchema={tableSchema} layout="inline" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
