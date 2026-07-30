/**
 * Group Dynamic Route
 * Handles fetching, updating, and deleting individual Groups.
 * Implements: docs/features/12_groups_workbenches.md §3
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, uuidSchema, withErrorHandler, parseBody } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { getGroupById, updateGroup, deleteGroup } from "@/lib/server/services/group-service";

export const runtime = "nodejs";

const UpdateGroupBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  parentGroupId: uuidSchema.nullable().optional(),
});

// ─────────────────────────────────────────────────────────
// GET /api/groups/:id
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Group ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const group = await getGroupById(user.id, orgIds, parsedId.data);
    return apiSuccess(group);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("Group not found", 404);
    }
    throw error;
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/groups/:id
// ─────────────────────────────────────────────────────────

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Group ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await parseBody(req, UpdateGroupBody);
  if (!body.success) return body.errorResponse;

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const group = await updateGroup(user.id, orgIds, parsedId.data, body.data);
    return apiSuccess(group);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError(error.message, 404);
    }
    if (error instanceof Error && error.message.includes("exceeds the maximum depth")) {
      return apiError(error.message, 400);
    }
    if (error instanceof Error && error.message.includes("different workbench")) {
      return apiError(error.message, 400);
    }
    throw error;
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/groups/:id
// ─────────────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Group ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const result = await deleteGroup(user.id, orgIds, parsedId.data);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("Group not found", 404);
    }
    throw error;
  }
});
