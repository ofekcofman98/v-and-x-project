/**
 * Group API Route
 * Handles creation of Groups (nestable under a Workbench or a parent Group).
 * Implements: docs/features/12_groups_workbenches.md §3
 */

import { z } from "zod";
import { apiSuccess, apiError, withErrorHandler, parseBody, uuidSchema } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { createGroup } from "@/lib/server/services/group-service";

export const runtime = "nodejs";

const CreateGroupBody = z.object({
  workbenchId: uuidSchema,
  parentGroupId: uuidSchema.optional(),
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
});

// ─────────────────────────────────────────────────────────
// POST /api/groups
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await parseBody(req, CreateGroupBody);
  if (!body.success) return body.errorResponse;

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const group = await createGroup({ userId: user.id, organizationIds: orgIds, ...body.data });
    return apiSuccess(group, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError(error.message, 404);
    }
    if (error instanceof Error && error.message.includes("exceeds the maximum depth")) {
      return apiError(error.message, 400);
    }
    if (error instanceof Error && error.message.includes("does not belong to the given workbench")) {
      return apiError(error.message, 400);
    }
    throw error;
  }
});
