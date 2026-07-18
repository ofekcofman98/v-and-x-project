/**
 * PATCH /api/tables/[id]/representative-column
 * Updates the Voice Key (representative column) for a table.
 * The chosen column must belong to the table's linked BaseList schema.
 * Based on: docs/features/01_cache_warming.md § API Contract
 */

import { z } from "zod";
import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  withErrorHandler,
  uuidSchema,
  parseBody,
} from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { updateRepresentativeColumn } from "@/lib/server/services/table-service";

export const runtime = "nodejs";

const patchSchema = z.object({
  representative_column: z.string().min(1, "representative_column is required"),
});

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError(`Invalid table ID format: ${id}`, 400);

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await parseBody(req, patchSchema);
  if (!body.success) return body.errorResponse;

  const orgIds = await getAccessibleOrganizationIds(user.id);
  try {
    const updated = await updateRepresentativeColumn(
      user.id,
      orgIds,
      parsedId.data,
      body.data.representative_column
    );
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found") && !error.message.includes("valid Base List column")) {
      return apiError(error.message, 404);
    }
    if (error instanceof Error && error.message.includes("valid Base List column")) {
      return apiError(error.message, 422);
    }
    throw error;
  }
});
