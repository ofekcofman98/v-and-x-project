/**
 * BaseList Templates API Route
 * Lists all templates applied to a specific BaseList.
 * Based on: docs/features/02_column_templates.md
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess, uuidSchema, withErrorHandler } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { listAppliedTemplates } from "@/lib/server/services/base-list-service";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/base-lists/:id/templates
// Returns all templates that have been applied to this BaseList
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid BaseList ID format", 400);

    const user = await getAuthenticatedUser();
    if (!user) return apiError("Unauthorized", 401);

    const orgIds = await getAccessibleOrganizationIds(user.id);
    try {
      const applied = await listAppliedTemplates(user.id, orgIds, parsedId.data);
      return apiSuccess(applied);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return apiError("BaseList not found", 404);
      }
      throw error;
    }
  }
);
