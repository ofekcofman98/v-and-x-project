import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from './DataTable';
import { EmptyEntitiesState } from '@/components/states/empty-state';
import type { ColumnDefinition, RowDefinition } from '@/lib/shared/types/table-schema';

interface TableGridSectionProps {
  tableId: string;
  columns: ColumnDefinition[];
  rows: RowDefinition[];
  hasData: boolean;
  totalRows: number;
}

export function TableGridSection({
  tableId,
  columns,
  rows,
  hasData,
  totalRows,
}: TableGridSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Grid</CardTitle>
        <CardDescription>
          Integrated view combining Base List entities and Table data columns
          {hasData && ` (${totalRows} ${totalRows === 1 ? 'row' : 'rows'})`}
        </CardDescription>
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
          />
        )}
      </CardContent>
    </Card>
  );
}
