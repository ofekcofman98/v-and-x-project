/**
 * Workbench Members Route
 * Adds/updates a Workbench-wide member.
 * Implements: docs/features/12_groups_workbenches.md §3
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, uuidSchema, withErrorHandler, parseBody } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { addWorkbenchMember } from "@/lib/server/services/workbench-service";
import { OrgRole } from "@/lib/shared/generated/prisma/client";

export const runtime = "nodejs";

const AddWorkbenchMemberBody = z.object({
  userId: uuidSchema,
  role: z.nativeEnum(OrgRole),
});

// ─────────────────────────────────────────────────────────
// POST /api/workbenches/:id/members
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Workbench ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await parseBody(req, AddWorkbenchMemberBody);
  if (!body.success) return body.errorResponse;

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const member = await addWorkbenchMember(user.id, orgIds, parsedId.data, body.data.userId, body.data.role);
    return apiSuccess(member, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("Workbench not found", 404);
    }
    throw error;
  }
});
