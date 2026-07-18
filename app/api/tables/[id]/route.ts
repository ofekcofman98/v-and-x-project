/**
 * Dynamic Table API Route
 * Handles fetching and deletion of individual tables.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §4 & §7.2
 * 
 * CRITICAL: GET includes both table columns AND baseList entities
 * for Grid UI rendering (rows come from BaseList, data columns from Table)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, withErrorHandler, uuidSchema } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds, ownershipWhere } from "@/lib/server/services/auth";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/tables/[id]
// Fetch a single table with its columns and parent BaseList entities
// ─────────────────────────────────────────────────────────


export const GET = withErrorHandler(async (
    req: NextRequest, 
    {params}: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError(`Invalid table ID format: ${id}`, 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  const table = await prisma.table.findFirst({
    where: { id: parsedId.data, ...ownershipWhere(user.id, orgIds) },
    include: {
      columns: true,
      baseList: {
        include: {
          entities: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!table) return apiError(`Table with ID ${parsedId.data} not found`, 404);

  return apiSuccess(table, 200);
});


// ─────────────────────────────────────────────────────────
// DELETE /api/tables/[id]
// Delete a table and all its associated records
// ─────────────────────────────────────────────────────────


export const DELETE = withErrorHandler(async (
  req: NextRequest, 
  {params}: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError(`Invalid table ID format: ${id}`, 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  const existingTable = await prisma.table.findFirst({
    where: { id: parsedId.data, ...ownershipWhere(user.id, orgIds) },
    select: { id: true, name: true },
  });

  if (!existingTable) return apiError(`Table with ID ${parsedId.data} not found`, 404);

  await prisma.table.delete({ where: { id: parsedId.data } });

  return apiSuccess(`Table '${existingTable.name}' deleted successfully`, 200);
});
