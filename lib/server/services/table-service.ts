import { prisma } from "@/lib/prisma";
import { Prisma, OrgRole } from "@/lib/shared/generated/prisma/client";
import { ownershipWhere } from "@/lib/server/services/auth";
import { filterAccessibleColumns, getUserRoleInOrg, filterBaseListSchemaAndEntities } from "@/lib/server/services/column-access";
import { ColumnAccessUpdate } from "@/lib/shared/types/column-access";
import type { ColumnFormula } from "@/lib/shared/types/formula";
import { ColumnType as ColumnTypeEnum } from "@/lib/shared/types/column-types";
import { validateFormula } from "@/lib/shared/utils/formula";
import { toColumnKey } from "@/lib/shared/utils/column-key";

type ColumnType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "COMPUTED";

interface CreateTableColumnInput {
  label: string;
  type: ColumnType;
  validation?: Record<string, unknown>;
  access?: ColumnAccessUpdate;
  formula?: ColumnFormula;
}

interface CreateTableInput {
  userId: string;
  organizationIds: string[];
  name: string;
  description?: string;
  baseListId?: string;
  representativeColumnKey: string;
  columns: CreateTableColumnInput[];
}

export async function createTable(input: CreateTableInput) {
  const { userId, organizationIds, name, description, baseListId, representativeColumnKey, columns } = input;

  if (baseListId) {
    const baseList = await prisma.baseList.findFirst({
      where: { id: baseListId, ...ownershipWhere(userId, organizationIds) },
      select: { id: true, schema: true },
    });

    if (!baseList) {
      throw new Error(`BaseList with id '${baseListId}' not found`);
    }

    const baseListSchema = baseList.schema as { columns: Array<{ id: string }> };
    const hasRepColumn = baseListSchema.columns.some((col) => col.id === representativeColumnKey);

    if (!hasRepColumn) {
      throw new Error(`Representative column '${representativeColumnKey}' not found in BaseList schema`);
    }
  }

  // Computed columns reference other columns by their (not-yet-persisted) key,
  // since real column ids don't exist until after insertion. Validate against
  // the submitted column set using keys before writing anything.
  const keyedColumns = columns.map((col) => ({ id: toColumnKey(col.label), type: col.type as ColumnTypeEnum }));
  for (const col of columns) {
    if (col.type === "COMPUTED" && col.formula) {
      const errors = validateFormula(toColumnKey(col.label), col.formula, keyedColumns);
      if (errors.length > 0) {
        throw new Error(`Invalid formula: ${errors.map((e) => e.message).join("; ")}`);
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const table = await tx.table.create({
      data: {
        name,
        description,
        baseListId,
        userId,
        representativeColumnKey,
        schema: { columns: [] } as Prisma.InputJsonValue,
        settings: {} as Prisma.InputJsonValue,
      },
    });

    await tx.tableColumn.createMany({
      data: columns.map((col, index) => ({
        tableId: table.id,
        key: toColumnKey(col.label),
        label: col.label,
        type: col.type,
        order: index,
        validation: col.validation ? (col.validation as Prisma.InputJsonValue) : Prisma.JsonNull,
        access: col.access ? (col.access as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        // formula.references still holds keys here — resolved to real column ids below.
        formula: col.formula ? (col.formula as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      })),
    });

    let tableColumns = await tx.tableColumn.findMany({
      where: { tableId: table.id },
      orderBy: { order: "asc" },
    });

    const keyToId = new Map(tableColumns.map((c) => [c.key, c.id]));
    const computedColumns = tableColumns.filter((c) => c.type === "COMPUTED" && c.formula);

    if (computedColumns.length > 0) {
      await Promise.all(
        computedColumns.map((col) => {
          const formula = col.formula as unknown as ColumnFormula;
          const resolvedFormula: ColumnFormula = {
            ...formula,
            references: formula.references.map((key) => keyToId.get(key) ?? key),
          };
          return tx.tableColumn.update({
            where: { id: col.id },
            data: { formula: resolvedFormula as unknown as Prisma.InputJsonValue },
          });
        })
      );

      tableColumns = await tx.tableColumn.findMany({
        where: { tableId: table.id },
        orderBy: { order: "asc" },
      });
    }

    return { ...table, columns: tableColumns };
  });
}

export async function listTables(userId: string, organizationIds: string[]) {
  return prisma.table.findMany({
    where: ownershipWhere(userId, organizationIds),
    include: {
      baseList: { select: { id: true, name: true } },
      _count: { select: { columns: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTableById(userId: string, organizationIds: string[], id: string) {
  const table = await prisma.table.findFirst({
    where: { id, ...ownershipWhere(userId, organizationIds) },
    include: {
      columns: true,
      baseList: {
        include: { entities: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!table) throw new Error(`Table with ID ${id} not found`);

  const isOwner = table.userId === userId;
  const role = table.organizationId ? await getUserRoleInOrg(userId, table.organizationId) : null;
  const columns = filterAccessibleColumns(table.columns, userId, isOwner, role);
  const baseList = filterEmbeddedBaseList(table.baseList, userId, isOwner, role);

  return { ...table, columns, baseList };
}

/** Filters a Table's embedded BaseList (schema.columns + entities) to what the caller may see. */
function filterEmbeddedBaseList<
  T extends { schema: unknown; entities: Array<{ values: unknown }> } | null,
>(baseList: T, userId: string, isOwner: boolean, role: OrgRole | null): T {
  if (!baseList) return baseList;

  const schema = baseList.schema as { columns: Array<{ id: string; access?: unknown }> };
  const { columns, entities } = filterBaseListSchemaAndEntities(
    schema,
    baseList.entities,
    userId,
    isOwner,
    role
  );

  return { ...baseList, schema: { ...schema, columns }, entities };
}

export async function deleteTable(userId: string, organizationIds: string[], id: string) {
  const existing = await prisma.table.findFirst({
    where: { id, ...ownershipWhere(userId, organizationIds) },
    select: { id: true, name: true },
  });

  if (!existing) throw new Error(`Table with ID ${id} not found`);

  await prisma.table.delete({ where: { id } });
  return existing;
}

export async function updateRepresentativeColumn(
  userId: string,
  organizationIds: string[],
  tableId: string,
  representativeColumn: string
) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, ...ownershipWhere(userId, organizationIds) },
    select: {
      id: true,
      representativeColumnKey: true,
      baseList: { select: { schema: true } },
    },
  });

  if (!table) throw new Error(`Table with ID ${tableId} not found`);

  if (table.baseList) {
    const schema = table.baseList.schema as { columns?: { id: string }[] };
    const validColumnIds = (schema.columns ?? []).map((c) => c.id);
    if (!validColumnIds.includes(representativeColumn)) {
      throw new Error(`Column '${representativeColumn}' is not a valid Base List column for this table`);
    }
  }

  const updated = await prisma.table.update({
    where: { id: tableId },
    data: { representativeColumnKey: representativeColumn },
    select: { id: true, representativeColumnKey: true },
  });

  return { id: updated.id, representative_column: updated.representativeColumnKey };
}

export async function getTableForExport(userId: string, organizationIds: string[], id: string) {
  const table = await prisma.table.findFirst({
    where: { id, ...ownershipWhere(userId, organizationIds) },
    include: {
      columns: { orderBy: { order: "asc" } },
      baseList: { include: { entities: { orderBy: { createdAt: "asc" } } } },
    },
  });

  if (!table) throw new Error(`Table with ID ${id} not found`);

  const isOwner = table.userId === userId;
  const role = table.organizationId ? await getUserRoleInOrg(userId, table.organizationId) : null;
  const columns = filterAccessibleColumns(table.columns, userId, isOwner, role);
  const baseList = filterEmbeddedBaseList(table.baseList, userId, isOwner, role);

  return { ...table, columns, baseList };
}

/**
 * Updates a column's visibility rule. Only the table owner or an org admin/owner may call this.
 */
export async function updateColumnAccess(
  userId: string,
  organizationIds: string[],
  tableId: string,
  columnId: string,
  access: ColumnAccessUpdate
) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, ...ownershipWhere(userId, organizationIds) },
    select: { id: true, userId: true, organizationId: true },
  });

  if (!table) throw new Error(`Table with ID ${tableId} not found`);

  const isOwner = table.userId === userId;
  const role = table.organizationId ? await getUserRoleInOrg(userId, table.organizationId) : null;
  const canManage = isOwner || role === OrgRole.OWNER || role === OrgRole.ADMIN;

  if (!canManage) throw new Error("Forbidden: only the table owner or an org admin can change column access");

  const column = await prisma.tableColumn.findUnique({
    where: { id: columnId },
    select: { id: true, tableId: true },
  });

  if (!column || column.tableId !== tableId) {
    throw new Error(`Column with ID ${columnId} not found on table ${tableId}`);
  }

  const updated = await prisma.tableColumn.update({
    where: { id: columnId },
    data: { access: access as unknown as Prisma.InputJsonValue },
    select: { id: true, access: true },
  });

  return updated;
}
