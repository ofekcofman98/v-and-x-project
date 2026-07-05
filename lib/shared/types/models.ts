/**
 * VocalGrid Product Data Models
 * 
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §1–2
 * Database: Prisma schema at prisma/schema.prisma
 * 
 * Separation of Concerns:
 * - BaseList: Entity registry (WHO or WHAT we're tracking)
 * - Table: Data collection instance (VALUES we're collecting)
 * - representativeColumnKey: Lives on Table, not BaseList
 *   → Same BaseList can be matched differently per Table
 * 
 * Type Hierarchy:
 * 1. Raw Prisma types (auto-generated from schema)
 * 2. Models with Relations (app/DB layer, includes nested objects)
 * 3. API DTOs (serialized for network transfer)
 * 4. TableSchema (Voice Engine compatibility layer)
 */

/**
 * Note: Import from Prisma Client after running:
 * npx prisma migrate dev --name init_core_schema
 * 
 * Until then, we define the enums inline for type safety.
 */

import type { ColumnDefinition, RowDefinition, TableSchema } from '@/lib/shared/types/table-schema';
import { ColumnType } from '@/lib/shared/types/column-types';

// ═══════════════════════════════════════════════════════════
// PRISMA ENUM MIRRORS (until Prisma Client is generated)
// ═══════════════════════════════════════════════════════════

/**
 * Mirrors the Prisma ColumnType enum
 * Source: prisma/schema.prisma
 */
export type PrismaColumnType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN';

/**
 * Mirrors the Prisma EntrySource enum
 * Source: prisma/schema.prisma
 */
export type PrismaEntrySource = 'VOICE' | 'MANUAL' | 'IMPORT';

// ═══════════════════════════════════════════════════════════
// COLUMN TYPE MAPPING
// ═══════════════════════════════════════════════════════════

/**
 * Maps Prisma enum values to existing ColumnType enum
 */
export function prismaColumnTypeToColumnType(prismaType: PrismaColumnType): ColumnType {
  switch (prismaType) {
    case 'TEXT':
      return ColumnType.TEXT;
    case 'NUMBER':
      return ColumnType.NUMBER;
    case 'DATE':
      return ColumnType.DATE;
    case 'BOOLEAN':
      return ColumnType.BOOLEAN;
    default:
      return ColumnType.TEXT;
  }
}

/**
 * Maps ColumnType to Prisma enum
 */
export function columnTypeToPrismaColumnType(type: ColumnType): PrismaColumnType {
  switch (type) {
    case ColumnType.TEXT:
      return 'TEXT';
    case ColumnType.NUMBER:
      return 'NUMBER';
    case ColumnType.DATE:
      return 'DATE';
    case ColumnType.BOOLEAN:
      return 'BOOLEAN';
    default:
      return 'TEXT';
  }
}

// ═══════════════════════════════════════════════════════════
// BASE LIST TYPES
// ═══════════════════════════════════════════════════════════

/**
 * Column definition within a BaseList schema
 */
export interface BaseListColumn {
  id: string;
  label: string;
  type: ColumnType;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Schema stored in BaseList.schema (JSONB)
 */
export interface BaseListSchema {
  columns: BaseListColumn[];
}

/**
 * BaseList entity (the entity registry)
 * Maps to: base_lists table
 */
export interface BaseList {
  id: string;
  name: string;
  description: string | null;
  schema: BaseListSchema;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * BaseList with relations (includes entities array)
 */
export interface BaseListWithEntities extends BaseList {
  entities: ListEntity[];
}

/**
 * API DTO for BaseList (dates serialized as ISO strings)
 */
export interface BaseListDTO {
  id: string;
  name: string;
  description: string | null;
  schema: BaseListSchema;
  createdAt: string;
  updatedAt: string;
}

/**
 * Minimal BaseList shape returned by GET /api/base-lists.
 * Used in ApplyTemplateDialog to let users choose target lists.
 * Columns are untyped strings here because the schema is stored as JSONB
 * and may contain column types from multiple schema versions.
 */
export interface BaseListSummaryDTO {
  id: string;
  name: string;
  description: string | null;
  schema: {
    columns: Array<{ id: string; label: string; type: string }>;
  } | null;
}

// ═══════════════════════════════════════════════════════════
// LIST ENTITY TYPES
// ═══════════════════════════════════════════════════════════

/**
 * Single row in a BaseList
 * Maps to: list_entities table
 * 
 * values shape: { [columnId: string]: string | number | boolean }
 * Example: { "first_name": "Alice", "student_id": "001", "email": "alice@school.edu" }
 */
export interface ListEntity {
  id: string;
  baseListId: string;
  values: Record<string, string | number | boolean>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API DTO for ListEntity
 */
export interface ListEntityDTO {
  id: string;
  baseListId: string;
  values: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// TABLE TYPES
// ═══════════════════════════════════════════════════════════

/**
 * Table settings stored in Table.settings (JSONB)
 */
export interface TableSettings {
  voice?: {
    defaultMode?: 'column-first' | 'row-first';
    autoAdvanceDelay?: number;
    confirmationThreshold?: number;
  };
  display?: {
    theme?: 'light' | 'dark';
    fontSize?: 'small' | 'medium' | 'large';
  };
}

/**
 * Table entity (data collection instance)
 * Maps to: tables table
 * 
 * CRITICAL: representativeColumnKey specifies which key in
 * ListEntity.values the Voice Engine uses for entity matching.
 * Same BaseList can be matched by different keys per Table.
 */
export interface Table {
  id: string;
  name: string;
  description: string | null;
  baseListId: string | null;
  
  /**
   * The column key used for voice entity matching.
   * Must reference a valid column in:
   * - BaseList.schema.columns[].id (if baseListId is set)
   * - Table's inline entity schema (if baseListId is null)
   * 
   * Examples:
   * - "first_name" → matches "Alice" in ListEntity.values.first_name
   * - "student_id" → matches "001" in ListEntity.values.student_id
   */
  representativeColumnKey: string;
  
  schema: TableSchemaJSON;
  settings: TableSettings;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Table with relations (includes columns, cells, and optionally baseList)
 */
export interface TableWithRelations extends Table {
  columns: TableColumn[];
  cells?: TableCell[];
  baseList?: BaseListWithEntities | null;
}

/**
 * API DTO for Table
 */
export interface TableDTO {
  id: string;
  name: string;
  description: string | null;
  baseListId: string | null;
  representativeColumnKey: string;
  schema: TableSchemaJSON;
  settings: TableSettings;
  createdAt: string;
  updatedAt: string;
}

/**
 * Schema stored in Table.schema (JSONB)
 * Stores additional data column metadata beyond what's in table_columns
 */
export interface TableSchemaJSON {
  columns: Array<{
    id: string;
    label: string;
    type: ColumnType;
    validation?: {
      required?: boolean;
      min?: number;
      max?: number;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
    };
    metadata?: {
      source?: 'base_list' | 'user_defined';
      baseListColumnId?: string;
    };
  }>;
}

// ═══════════════════════════════════════════════════════════
// TABLE COLUMN TYPES
// ═══════════════════════════════════════════════════════════

/**
 * Column validation stored in TableColumn.validation (JSONB)
 */
export interface TableColumnValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

/**
 * TableColumn entity (one data-entry column in a Table)
 * Maps to: table_columns table
 */
export interface TableColumn {
  id: string;
  tableId: string;
  key: string;
  label: string;
  type: PrismaColumnType;
  order: number;
  validation: TableColumnValidation | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API DTO for TableColumn
 */
export interface TableColumnDTO {
  id: string;
  tableId: string;
  key: string;
  label: string;
  type: PrismaColumnType;
  order: number;
  validation: TableColumnValidation | null;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// TABLE CELL TYPES
// ═══════════════════════════════════════════════════════════

/**
 * Cell value stored in TableCell.value (JSONB)
 * Wraps the actual value to maintain type info
 */
export interface CellValue {
  value: string | number | boolean | null;
}

/**
 * TableCell entity (single data point at row × column intersection)
 * Maps to: table_cells table
 */
export interface TableCell {
  id: string;
  tableId: string;
  tableColumnId: string;
  entityId: string | null;
  rowKey: string;
  value: CellValue;
  entrySource: PrismaEntrySource;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TableCell with relations
 */
export interface TableCellWithRelations extends TableCell {
  tableColumn?: TableColumn;
  entity?: ListEntity | null;
}

/**
 * API DTO for TableCell
 */
export interface TableCellDTO {
  id: string;
  tableId: string;
  tableColumnId: string;
  entityId: string | null;
  rowKey: string;
  value: CellValue;
  entrySource: PrismaEntrySource;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// VOICE ENGINE COMPATIBILITY LAYER
// ═══════════════════════════════════════════════════════════

/**
 * Converts a TableWithRelations to the TableSchema format
 * used by the Voice Engine.
 * 
 * This function bridges the gap between our new product data
 * model (BaseList + Table) and the existing voice pipeline.
 * 
 * @param table - Table with columns and baseList/entities loaded
 * @returns TableSchema compatible with voice-entry API
 * 
 * @example
 * ```ts
 * const table = await prisma.table.findUnique({
 *   where: { id: tableId },
 *   include: {
 *     columns: { orderBy: { order: 'asc' } },
 *     baseList: { include: { entities: true } }
 *   }
 * });
 * 
 * const voiceSchema = toTableSchema(table);
 * // Now use voiceSchema with voice-entry API
 * ```
 */
export function toTableSchema(table: TableWithRelations): TableSchema {
  // Convert data entry columns (from table_columns table)
  const columns: ColumnDefinition[] = table.columns.map(col => ({
    id: col.key,
    label: col.label,
    type: prismaColumnTypeToColumnType(col.type),
    validation: col.validation ? {
      required: col.validation.required,
      min: col.validation.min,
      max: col.validation.max,
      minLength: col.validation.minLength,
      maxLength: col.validation.maxLength,
      pattern: col.validation.pattern,
    } : undefined,
  }));

  // Build rows from BaseList entities or inline entities
  const rows: RowDefinition[] = [];

  if (table.baseList?.entities) {
    // BaseList-backed table: rows come from list entities
    for (const entity of table.baseList.entities) {
      // Extract the representative column value for this entity
      const repValue = entity.values[table.representativeColumnKey];
      if (repValue !== undefined && repValue !== null) {
        rows.push({
          id: entity.id,
          label: String(repValue),
        });
      }
    }
  } else if (table.cells) {
    // Standalone table: extract unique rowKeys from cells
    const rowKeySet = new Set<string>();
    const rowMap = new Map<string, string>();

    for (const cell of table.cells) {
      if (!rowKeySet.has(cell.rowKey)) {
        rowKeySet.add(cell.rowKey);
        
        // Try to find a label using representativeColumnKey
        const repColKey = table.representativeColumnKey;
        const repColumn = table.columns.find(col => col.key === repColKey);
        
        if (repColumn && cell.tableColumnId === repColumn.id) {
          rowMap.set(cell.rowKey, String(cell.value.value ?? cell.rowKey));
        }
      }
    }

    // Fallback: if no label found via representative column, use rowKey
    for (const rowKey of rowKeySet) {
      rows.push({
        id: rowKey,
        label: rowMap.get(rowKey) ?? rowKey,
      });
    }
  }

  return { columns, rows };
}

/**
 * Extract entity vocabulary from a Table for voice matching.
 * Returns the list of entity names the Voice Engine should match against.
 * 
 * @param table - Table with baseList/entities loaded
 * @returns Array of entity names (representative column values)
 * 
 * @example
 * ```ts
 * const entityNames = getEntityVocabulary(table);
 * // ["Alice Johnson", "Bob Smith", "Charlie Brown"]
 * ```
 */
export function getEntityVocabulary(table: TableWithRelations): string[] {
  if (!table.baseList?.entities) {
    return [];
  }

  const vocabulary: string[] = [];
  for (const entity of table.baseList.entities) {
    const value = entity.values[table.representativeColumnKey];
    if (value !== undefined && value !== null) {
      vocabulary.push(String(value));
    }
  }

  return vocabulary;
}

/**
 * Validates that representativeColumnKey references a valid column
 * in the BaseList schema.
 * 
 * @param table - Table to validate
 * @param baseListSchema - Schema from the linked BaseList
 * @returns true if valid, false otherwise
 */
export function validateRepresentativeColumn(
  table: Table,
  baseListSchema: BaseListSchema
): boolean {
  if (!table.baseListId) {
    return true;
  }

  return baseListSchema.columns.some(
    col => col.id === table.representativeColumnKey
  );
}
