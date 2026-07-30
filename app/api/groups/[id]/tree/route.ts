/**
 * Group Tree Route
 * Fetches a Group's full recursive subtree (child Groups + their lists) in one call.
 * Implements: docs/features/12_groups_workbenches.md §3, §5
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess, uuidSchema, withErrorHandler } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { getGroupTree } from "@/lib/server/services/group-service";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/groups/:id/tree
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Group ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const tree = await getGroupTree(user.id, orgIds, parsedId.data);
    return apiSuccess(tree);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("Group not found", 404);
    }
    throw error;
  }
});
