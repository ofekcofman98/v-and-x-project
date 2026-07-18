import { prisma } from "@/lib/prisma";
import { EntrySource } from "@/lib/shared/generated/prisma/client";
import { canAccessColumn, getUserRoleInOrg } from "@/lib/server/services/column-access";

export interface UpsertCellInput {
  tableId: string;
  userId: string;
  rowKey: string;
  tableColumnId: string;
  value: string | number | boolean | null;
  entityId?: string | null;
  entrySource?: EntrySource;
}

export interface GetCellsInput {
    tableId: string;
    userId: string;
    rowKey?: string;
}
  
  /**
   * Fetches all cells for a table, optionally filtered by rowKey.
   * Returns cells with their column and entity information included.
   * 
   * @param input - Query parameters including tableId and optional rowKey
   * @returns Array of TableCell records with relations
   * @throws Error if the table doesn't exist
   */
  export async function getCells(input: GetCellsInput) {
    const { tableId, userId, rowKey } = input;

    // Validate that the table exists
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      select: { id: true, userId: true, organizationId: true },
    });

    if (!table) {
      throw new Error(`Table with ID ${tableId} not found`);
    }

    const isOwner = table.userId === userId;
    const role = table.organizationId ? await getUserRoleInOrg(userId, table.organizationId) : null;

    // Build the query filters
    const where = {
      tableId,
      ...(rowKey && { rowKey }), // Only add rowKey filter if provided
    };

    // Fetch cells with related data
    const cells = await prisma.tableCell.findMany({
      where,
      include: {
        tableColumn: {
          select: {
            id: true,
            key: true,
            label: true,
            type: true,
            order: true,
            access: true,
          },
        },
        entity: {
          select: {
            id: true,
            values: true,
          },
        },
      },
      orderBy: [
        { rowKey: 'asc' },           // Group by row
        { tableColumn: { order: 'asc' } }, // Then by column order
      ],
    });

    return cells.filter((cell) => canAccessColumn(cell.tableColumn, userId, isOwner, role));
  }

/**
 * Upserts a single cell value into the TableCell table.
 * Uses Prisma's upsert to handle the unique constraint on (tableId, rowKey, tableColumnId).
 * 
 * @param input - Cell data including tableId, rowKey, tableColumnId, and value
 * @returns The created or updated TableCell record
 * @throws Error if the table or column doesn't exist, or if validation fails
 */

export async function upsertCell(input: UpsertCellInput) {
  const {
    tableId,
    userId,
    rowKey,
    tableColumnId,
    value,
    entityId = null,
    entrySource = EntrySource.MANUAL,
  } = input;

  // Validate that the table exists
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { id: true, userId: true, organizationId: true },
  });

  if (!table) {
    throw new Error(`Table with ID ${tableId} not found`);
  }

  // Validate that the column exists and belongs to this table
  const column = await prisma.tableColumn.findUnique({
    where: { id: tableColumnId },
    select: { id: true, tableId: true, access: true },
  });

  if (!column) {
    throw new Error(`Column with ID ${tableColumnId} not found`);
  }

  if (column.tableId !== tableId) {
    throw new Error(`Column ${tableColumnId} does not belong to table ${tableId}`);
  }

  const isOwner = table.userId === userId;
  const role = table.organizationId ? await getUserRoleInOrg(userId, table.organizationId) : null;

  if (!canAccessColumn(column, userId, isOwner, role)) {
    throw new Error(`Forbidden: you do not have access to column ${tableColumnId}`);
  }

  // Validate entityId if provided
  if (entityId) {
    const entity = await prisma.listEntity.findUnique({
      where: { id: entityId },
      select: { id: true },
    });

    if (!entity) {
      throw new Error(`Entity with ID ${entityId} not found`);
    }
  }

  // Perform the upsert
  const cell = await prisma.tableCell.upsert({
    where: {
      tableId_rowKey_tableColumnId: {
        tableId,
        rowKey,
        tableColumnId,
      },
    },
    update: {
      value: { value },
      entrySource,
      updatedAt: new Date(),
    },
    create: {
      tableId,
      rowKey,
      tableColumnId,
      entityId,
      value: { value },
      entrySource,
    },
  });

  return cell;
}