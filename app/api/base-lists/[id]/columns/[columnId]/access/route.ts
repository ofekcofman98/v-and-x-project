import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, withErrorHandler, uuidSchema, parseBody } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { updateBaseListColumnAccess } from "@/lib/server/services/base-list-service";
import { OrgRole } from "@/lib/shared/generated/prisma/client";

export const runtime = "nodejs";

const columnAccessSchema = z.object({
  visibility: z.enum(["public", "private"]),
  allowedRoles: z.array(z.nativeEnum(OrgRole)).optional(),
  allowedUserIds: z.array(uuidSchema).optional(),
});

// ─────────────────────────────────────────────────────────
// PATCH /api/base-lists/[id]/columns/[columnId]/access
// Update a BaseList column's visibility rule. Owner/org-admin only.
// columnId is a schema-defined slug (e.g. "name"), not a UUID.
// ─────────────────────────────────────────────────────────

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) => {
  const { id: baseListId, columnId } = await params;

  const parsedBaseListId = uuidSchema.safeParse(baseListId);
  if (!parsedBaseListId.success) return apiError(`Invalid BaseList ID format: ${baseListId}`, 400);

  if (!columnId) return apiError("Invalid column ID", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const bodyResult = await parseBody(req, columnAccessSchema);
  if (!bodyResult.success) return bodyResult.errorResponse;

  const orgIds = await getAccessibleOrganizationIds(user.id);

  try {
    const updated = await updateBaseListColumnAccess(
      user.id,
      orgIds,
      parsedBaseListId.data,
      columnId,
      bodyResult.data
    );
    return apiSuccess(updated, 200);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) return apiError(error.message, 403);
      if (error.message.includes("not found")) return apiError(error.message, 404);
    }
    throw error;
  }
});
