/**
 * Dynamic Table API Route
 * Handles fetching and deletion of individual tables.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §4 & §7.2
 *
 * CRITICAL: GET includes both table columns AND baseList entities
 * for Grid UI rendering (rows come from BaseList, data columns from Table)
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError, withErrorHandler, uuidSchema } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { getTableById, deleteTable } from "@/lib/server/services/table-service";

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
  try {
    const table = await getTableById(user.id, orgIds, parsedId.data);
    return apiSuccess(table, 200);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError(error.message, 404);
    }
    throw error;
  }
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
  try {
    const existingTable = await deleteTable(user.id, orgIds, parsedId.data);
    return apiSuccess(`Table '${existingTable.name}' deleted successfully`, 200);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError(error.message, 404);
    }
    throw error;
  }
});
