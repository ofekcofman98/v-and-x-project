/**
 * Apply Template to Group API Route
 * Bulk-applies a column template to every BaseList under a Group's subtree,
 * recursively through nested child Groups — one Table per list.
 * Implements: docs/features/12_groups_workbenches.md §3.1
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, uuidSchema, withErrorHandler, parseBody } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { applyTemplateToGroup } from "@/lib/server/services/group-service";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────

const ApplyTemplateBody = z.object({
  templateId: z.string().uuid("Invalid template_id format"),
  autoSync: z.boolean().default(false),
  selectedBaseListColumnIds: z.array(z.string()).default([]),
});

// ─────────────────────────────────────────────────────────
// POST /api/groups/:id/apply-template
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid Group ID format", 400);

    const user = await getAuthenticatedUser();
    if (!user) return apiError("Unauthorized", 401);

    const body = await parseBody(req, ApplyTemplateBody);
    if (!body.success) return body.errorResponse;

    const orgIds = await getAccessibleOrganizationIds(user.id);
    try {
      const result = await applyTemplateToGroup({
        userId: user.id,
        organizationIds: orgIds,
        groupId: parsedId.data,
        ...body.data,
      });
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return apiError("Group not found", 404);
      }
      if (error instanceof Error && error.message.includes("exceeding the max of")) {
        return apiError(error.message, 400);
      }
      throw error;
    }
  }
);
