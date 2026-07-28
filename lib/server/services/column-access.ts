import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/shared/generated/prisma/client";
import { ColumnAccess } from "@/lib/shared/types/column-access";

/** The caller's role in the organization that owns the table, or null if not a member. */
export async function getUserRoleInOrg(userId: string, organizationId: string): Promise<OrgRole | null> {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });

  return membership?.role ?? null;
}

export interface TableAccessContext {
  table: { id: string; userId: string; organizationId: string | null };
  isOwner: boolean;
  role: OrgRole | null;
}

/**
 * Fetches a table and resolves the caller's ownership/role context in one
 * call — the `table.findUnique` + `isOwner` + `getUserRoleInOrg` sequence
 * repeated across cells.ts and the AI Grid Agent's tool executors.
 *
 * @throws Error (message includes "not found") if the table doesn't exist.
 */
export async function getTableAccessContext(tableId: string, userId: string): Promise<TableAccessContext> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { id: true, userId: true, organizationId: true },
  });

  if (!table) {
    throw new Error(`Table with ID ${tableId} not found`);
  }

  const isOwner = table.userId === userId;
  const role = table.organizationId ? await getUserRoleInOrg(userId, table.organizationId) : null;

  return { table, isOwner, role };
}

interface AccessCheckColumn {
  access?: unknown;
}

/**
 * Whether `userId` may see/write a column. Table owners always have access.
 * A column with no access rule (or visibility "public") is open to every table member.
 */
export function canAccessColumn(
  column: AccessCheckColumn,
  userId: string,
  isOwner: boolean,
  role: OrgRole | null
): boolean {
  if (isOwner) return true;

  const access = column.access as ColumnAccess | null;
  if (!access || access.visibility === "public") return true;

  const roleMatch = role !== null && (access.allowedRoles ?? []).includes(role);
  const userMatch = (access.allowedUserIds ?? []).includes(userId);

  return roleMatch || userMatch;
}

export function filterAccessibleColumns<T extends AccessCheckColumn>(
  columns: T[],
  userId: string,
  isOwner: boolean,
  role: OrgRole | null
): T[] {
  return columns.filter((column) => canAccessColumn(column, userId, isOwner, role));
}

interface SchemaWithAccessColumns<T extends AccessCheckColumn & { id: string }> {
  columns: T[];
}

interface EntityWithValues {
  values: unknown;
}

/**
 * Filters a BaseList-shaped schema (columns embedded in JSONB) down to the
 * caller's accessible columns, and strips the corresponding keys out of every
 * entity's `values`. Shared between base-list-service.ts (viewing a BaseList
 * directly) and table-service.ts (a Table's embedded BaseList).
 */
export function filterBaseListSchemaAndEntities<
  C extends AccessCheckColumn & { id: string },
  E extends EntityWithValues,
>(
  schema: SchemaWithAccessColumns<C>,
  entities: E[],
  userId: string,
  isOwner: boolean,
  role: OrgRole | null
): { columns: C[]; entities: E[] } {
  const hiddenColumnIds = new Set(
    schema.columns.filter((col) => !canAccessColumn(col, userId, isOwner, role)).map((col) => col.id)
  );

  if (hiddenColumnIds.size === 0) return { columns: schema.columns, entities };

  const columns = schema.columns.filter((col) => !hiddenColumnIds.has(col.id));
  const filteredEntities = entities.map((entity) => {
    const values = entity.values as Record<string, unknown>;
    const filteredValues = Object.fromEntries(
      Object.entries(values).filter(([key]) => !hiddenColumnIds.has(key))
    );
    return { ...entity, values: filteredValues };
  });

  return { columns, entities: filteredEntities };
}
