/**
 * Workbench Dynamic Route
 * Handles fetching, updating, and deleting individual Workbenches.
 * Implements: docs/features/12_groups_workbenches.md §3
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, uuidSchema, withErrorHandler, parseBody } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { getWorkbenchById, updateWorkbench, deleteWorkbench } from "@/lib/server/services/workbench-service";

export const runtime = "nodejs";

const UpdateWorkbenchBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────
// GET /api/workbenches/:id
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Workbench ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const workbench = await getWorkbenchById(user.id, orgIds, parsedId.data);
    return apiSuccess(workbench);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("Workbench not found", 404);
    }
    throw error;
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/workbenches/:id
// ─────────────────────────────────────────────────────────

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Workbench ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await parseBody(req, UpdateWorkbenchBody);
  if (!body.success) return body.errorResponse;

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const workbench = await updateWorkbench(user.id, orgIds, parsedId.data, body.data);
    return apiSuccess(workbench);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("Workbench not found", 404);
    }
    throw error;
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/workbenches/:id
// ─────────────────────────────────────────────────────────

export const DELETE = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError("Invalid Workbench ID format", 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const result = await deleteWorkbench(user.id, orgIds, parsedId.data);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError("Workbench not found", 404);
    }
    throw error;
  }
});
