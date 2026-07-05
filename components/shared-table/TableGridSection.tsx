import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from './DataTable';
import { EmptyEntitiesState } from '@/components/states/empty-state';
import type { ColumnDefinition, RowDefinition } from '@/lib/shared/types/table-schema';

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{resolvedDescription}</CardDescription>
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
      </CardContent>
    </Card>
  );
}
