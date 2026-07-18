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

interface AccessCheckColumn {
  access: unknown;
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
