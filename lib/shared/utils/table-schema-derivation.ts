/**
 * Derives grid columns/rows from a fetched Table + its BaseList.
 * Extracted verbatim from app/dashboard/tables/[id]/page.tsx so the
 * workspace grid (docs/features/16_master_detail_workspace.md §6) and the
 * standalone table page share one derivation instead of two copies.
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §3
 */

import type { TableCell, TableColumn, ListEntity, BaseListWithEntities, BaseListSchema } from '@/lib/shared/types/models';
import { ColumnType } from '@/lib/shared/types/column-types';
import { prismaColumnTypeToColumnType } from '@/lib/shared/types/models';
import type { ColumnDefinition, RowDefinition } from '@/lib/shared/types/table-schema';

export interface ListEntityDTO extends Omit<ListEntity, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface BaseListWithEntitiesDTO extends Omit<BaseListWithEntities, 'createdAt' | 'updatedAt' | 'entities'> {
  createdAt: string;
  updatedAt: string;
  entities: ListEntityDTO[];
}

export interface TableCellDTO extends Omit<TableCell, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface TableColumnDTO extends Omit<TableColumn, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface TableWithRelationsDTO {
  id: string;
  name: string;
  description: string | null;
  baseListId: string | null;
  representativeColumnKey: string;
  schema: { columns: Array<{ id: string; label: string; type: string; formula?: unknown }> };
  createdAt: string;
  updatedAt: string;
  columns: TableColumnDTO[];
  cells?: TableCellDTO[];
  baseList?: BaseListWithEntitiesDTO | null;
}

/**
 * table.schema.columns (JSONB) is the single source of truth for the grid layout.
 * For tables created via apply-template it holds the complete merged schema
 * (identity + template columns). Only fall back to the legacy path of combining
 * baseList.schema + relational table.columns for pre-existing tables where the
 * JSON schema is empty — this preserves backward compatibility.
 */
export function deriveTableColumns(table: TableWithRelationsDTO | null | undefined): ColumnDefinition[] {
  if (!table) return [];
  const baseList = table.baseList;
  const baseListSchemaColumnIds = new Set(((baseList?.schema as BaseListSchema)?.columns ?? []).map((c) => c.id));
  const tableSchemaColumns = table.schema?.columns ?? [];
  const relationalTableColumns = table.columns ?? [];

  return tableSchemaColumns.length > 0
    ? tableSchemaColumns.map((col) => ({
        id: col.id,
        label: col.label,
        type: col.type as unknown as ColumnType,
        isBaseColumn: baseListSchemaColumnIds.has(col.id),
        formula: col.formula as ColumnDefinition['formula'],
      }))
    : [
        ...((baseList?.schema as BaseListSchema)?.columns ?? []).map((col) => ({
          id: col.id,
          label: col.label,
          type: (col.type as string).toUpperCase() as ColumnType,
          isBaseColumn: true as const,
        })),
        ...relationalTableColumns.map((col) => ({
          id: col.id,
          label: col.label,
          type: prismaColumnTypeToColumnType(col.type),
          isBaseColumn: false as const,
          access: col.access,
          formula: col.formula ?? undefined,
        })),
      ];
}

export function deriveTableRows(
  table: TableWithRelationsDTO | null | undefined,
  columns: ColumnDefinition[]
): RowDefinition[] {
  if (!table) return [];
  const entities = table.baseList?.entities ?? [];
  const repColId = table.representativeColumnKey;
  // Resolve entity display labels. Only search within base columns because
  // entity.values exclusively holds data for base-list-originated columns.
  const firstTextBaseColId =
    columns.find((col) => col.isBaseColumn && (col.type as string).toUpperCase() === 'TEXT')?.id ??
    columns.find((col) => col.isBaseColumn)?.id;

  return entities.map((entity) => ({
    id: entity.id,
    label: (entity.values[repColId] ?? entity.values[firstTextBaseColId ?? ''])?.toString() || entity.id,
    values: entity.values,
  }));
}
