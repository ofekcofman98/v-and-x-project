/**
 * Base List Dynamic Route
 * Handles fetching and deleting individual Base Lists.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §3 & §7.1
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, uuidSchema, withErrorHandler } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds, ownershipWhere } from "@/lib/server/services/auth";

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
    const baseList = await prisma.baseList.findFirst({
      where: { id: parsedId.data, ...ownershipWhere(user.id, orgIds) },
      include: { entities: true },
    });

    if (!baseList) return apiError("BaseList not found", 404);

    return apiSuccess(baseList);
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
    const existingBaseList = await prisma.baseList.findFirst({
      where: { id: parsedId.data, ...ownershipWhere(user.id, orgIds) },
      select: { id: true },
    });

    if (!existingBaseList) return apiError("BaseList not found", 404);

    await prisma.baseList.delete({ where: { id: parsedId.data } });

    return apiSuccess({ id: parsedId.data });
  });