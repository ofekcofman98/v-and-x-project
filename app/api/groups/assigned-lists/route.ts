/**
 * Assigned Base Lists Route
 * Every BaseList currently assigned to a Group the caller can access — powers
 * the global "Unassigned Lists" view and MoveListDialog's current-location display.
 * Implements: docs/features/12_groups_workbenches.md §9.2
 */

import { apiError, apiSuccess, withErrorHandler } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { getAssignedBaseLists } from "@/lib/server/services/group-service";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/groups/assigned-lists
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  const assigned = await getAssignedBaseLists(user.id, orgIds);
  return apiSuccess(assigned);
});
