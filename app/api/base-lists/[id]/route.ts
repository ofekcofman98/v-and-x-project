/**
 * Base List Dynamic Route
 * Handles fetching and deleting individual Base Lists.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §3 & §7.1
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess, uuidSchema, withErrorHandler } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { getBaseListById, deleteBaseList } from "@/lib/server/services/base-list-service";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/base-lists/:id
// Fetches a single BaseList with all associated entities
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid BaseList ID format", 400);

    const user = await getAuthenticatedUser();
    if (!user) return apiError("Unauthorized", 401);

    const orgIds = await getAccessibleOrganizationIds(user.id);
    try {
      const baseList = await getBaseListById(user.id, orgIds, parsedId.data);
      return apiSuccess(baseList);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return apiError("BaseList not found", 404);
      }
      throw error;
    }
  });

// ─────────────────────────────────────────────────────────
// DELETE /api/base-lists/:id
// Deletes a BaseList and cascades to all associated entities
// ─────────────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid BaseList ID format", 400);

    const user = await getAuthenticatedUser();
    if (!user) return apiError("Unauthorized", 401);

    const orgIds = await getAccessibleOrganizationIds(user.id);
    try {
      const result = await deleteBaseList(user.id, orgIds, parsedId.data);
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return apiError("BaseList not found", 404);
      }
      throw error;
    }
  });
