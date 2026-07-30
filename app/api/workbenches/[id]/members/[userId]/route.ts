/**
 * Workbench Member Dynamic Route
 * Removes a Workbench-wide member.
 * Implements: docs/features/12_groups_workbenches.md §3
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess, uuidSchema, withErrorHandler } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { removeWorkbenchMember } from "@/lib/server/services/workbench-service";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// DELETE /api/workbenches/:id/members/:userId
// ─────────────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) => {
  const { id, userId: targetUserId } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Workbench ID format", 400);

  const parsedTargetUserId = uuidSchema.safeParse(targetUserId);
  if (!parsedTargetUserId.success) return apiError("Invalid user ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const result = await removeWorkbenchMember(user.id, orgIds, parsedId.data, parsedTargetUserId.data);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError(error.message, 404);
    }
    throw error;
  }
});
