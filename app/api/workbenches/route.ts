/**
 * Workbench API Route
 * Handles creation and listing of Workbenches.
 * Implements: docs/features/12_groups_workbenches.md §3
 */

import { z } from "zod";
import { apiSuccess, apiError, withErrorHandler, parseBody, uuidSchema } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { createWorkbench, listWorkbenches } from "@/lib/server/services/workbench-service";

export const runtime = "nodejs";

const CreateWorkbenchBody = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  organizationId: uuidSchema.optional(),
});

// ─────────────────────────────────────────────────────────
// POST /api/workbenches
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await parseBody(req, CreateWorkbenchBody);
  if (!body.success) return body.errorResponse;

  const workbench = await createWorkbench({ userId: user.id, ...body.data });

  return apiSuccess(workbench, 201);
});

// ─────────────────────────────────────────────────────────
// GET /api/workbenches
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  const workbenches = await listWorkbenches(user.id, orgIds);
  return apiSuccess(workbenches, 200);
});
