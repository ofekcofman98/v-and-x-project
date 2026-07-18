import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, withErrorHandler, uuidSchema, parseBody } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { updateColumnAccess } from "@/lib/server/services/table-service";
import { OrgRole } from "@/lib/shared/generated/prisma/client";

export const runtime = "nodejs";

const columnAccessSchema = z.object({
  visibility: z.enum(["public", "private"]),
  allowedRoles: z.array(z.nativeEnum(OrgRole)).optional(),
  allowedUserIds: z.array(uuidSchema).optional(),
});

// ─────────────────────────────────────────────────────────
// PATCH /api/tables/[id]/columns/[columnId]/access
// Update a column's visibility rule. Owner/org-admin only.
// ─────────────────────────────────────────────────────────

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) => {
  const { id: tableId, columnId } = await params;

  const parsedTableId = uuidSchema.safeParse(tableId);
  if (!parsedTableId.success) return apiError(`Invalid table ID format: ${tableId}`, 400);

  const parsedColumnId = uuidSchema.safeParse(columnId);
  if (!parsedColumnId.success) return apiError(`Invalid column ID format: ${columnId}`, 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const bodyResult = await parseBody(req, columnAccessSchema);
  if (!bodyResult.success) return bodyResult.errorResponse;

  const orgIds = await getAccessibleOrganizationIds(user.id);

  try {
    const updated = await updateColumnAccess(
      user.id,
      orgIds,
      parsedTableId.data,
      parsedColumnId.data,
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
