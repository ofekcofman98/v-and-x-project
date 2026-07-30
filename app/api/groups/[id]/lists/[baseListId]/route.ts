/**
 * Group List Dynamic Route
 * Removes a BaseList from a Group.
 * Implements: docs/features/12_groups_workbenches.md §3
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess, uuidSchema, withErrorHandler } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { removeBaseListFromGroup } from "@/lib/server/services/group-service";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// DELETE /api/groups/:id/lists/:baseListId
// ─────────────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; baseListId: string }> }
) => {
  const { id, baseListId } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Group ID format", 400);

  const parsedBaseListId = uuidSchema.safeParse(baseListId);
  if (!parsedBaseListId.success) return apiError("Invalid BaseList ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const result = await removeBaseListFromGroup(user.id, orgIds, parsedId.data, parsedBaseListId.data);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError(error.message, 404);
    }
    throw error;
  }
});
