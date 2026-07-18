/**
 * Apply Template to BaseList API Route
 * Applies a column template to an existing BaseList, merging or replacing columns.
 * Based on: docs/features/02_column_templates.md
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, uuidSchema, withErrorHandler, parseBody } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { applyTemplateToBaseList } from "@/lib/server/services/base-list-service";

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
// POST /api/base-lists/:id/apply-template
// Applies a column template's schema to the BaseList
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid BaseList ID format", 400);

    const user = await getAuthenticatedUser();
    if (!user) return apiError("Unauthorized", 401);

    const body = await parseBody(req, ApplyTemplateBody);
    if (!body.success) return body.errorResponse;

    const orgIds = await getAccessibleOrganizationIds(user.id);
    try {
      const result = await applyTemplateToBaseList({
        userId: user.id,
        organizationIds: orgIds,
        baseListId: parsedId.data,
        ...body.data,
      });
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof Error && error.message === "BaseList not found") {
        return apiError("BaseList not found", 404);
      }
      if (error instanceof Error && error.message === "Column template not found") {
        return apiError("Column template not found", 404);
      }
      throw error;
    }
  }
);
