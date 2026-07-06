import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { columnPillClass } from './template-categories';

interface TemplateColumn {
  id: string;
  label: string;
  type: string;
  validation?: Record<string, unknown>;
}

interface TemplateSchemaSectionProps {
  columns: TemplateColumn[];
  category: string | null;
}

export const TemplateSchemaSection = React.memo(function TemplateSchemaSection({
  columns,
  category,
}: TemplateSchemaSectionProps) {
  const pillClass = columnPillClass(category);
  const hasValidation = columns.some(
    (col) => col.validation && Object.keys(col.validation).length > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Column Schema</CardTitle>
        <CardDescription>
          {columns.length === 0
            ? 'No columns defined in this template.'
            : `${columns.length} column${columns.length !== 1 ? 's' : ''} defined in this template`}
        </CardDescription>
      </CardHeader>

      {columns.length > 0 && (
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                {hasValidation && <TableHead>Validation</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col) => {
                const validationEntries = col.validation
                  ? Object.entries(col.validation).filter(
                      ([, v]) => v !== undefined && v !== null && v !== ''
                    )
                  : [];

                return (
                  <TableRow key={col.id}>
                    <TableCell>
                      <span className="font-medium">{col.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground/50 font-mono">
                        {col.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${pillClass}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                        {col.type.toLowerCase()}
                      </span>
                    </TableCell>
                    {hasValidation && (
                      <TableCell className="text-xs text-muted-foreground">
                        {validationEntries.length > 0
                          ? validationEntries.map(([k, v]) => `${k}: ${String(v)}`).join(', ')
                          : '—'}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
});
