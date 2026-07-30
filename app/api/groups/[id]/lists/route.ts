/**
 * Group Lists Route
 * Adds a BaseList to a Group.
 * Implements: docs/features/12_groups_workbenches.md §3
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, uuidSchema, withErrorHandler, parseBody } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { addBaseListToGroup } from "@/lib/server/services/group-service";

export const runtime = "nodejs";

const AddBaseListBody = z.object({
  baseListId: uuidSchema,
});

// ─────────────────────────────────────────────────────────
// POST /api/groups/:id/lists
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Group ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await parseBody(req, AddBaseListBody);
  if (!body.success) return body.errorResponse;

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const link = await addBaseListToGroup(user.id, orgIds, parsedId.data, body.data.baseListId);
    return apiSuccess(link, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("Group not found", 404);
    }
    throw error;
  }
});
