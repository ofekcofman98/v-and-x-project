import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, withErrorHandler, uuidSchema, parseBody } from "@/lib/shared/utils/api";
import { upsertCellsBatch } from "@/lib/server/services/cells";
import { EntrySource } from "@/lib/shared/generated/prisma/client";
import { getAuthenticatedUser, getAccessibleOrganizationIds, ownershipWhere } from "@/lib/server/services/auth";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Request body schema
// ─────────────────────────────────────────────────────────

const MAX_BATCH_SIZE = 100;

const patchCellsBatchSchema = z.object({
  writes: z
    .array(
      z.object({
        rowKey: uuidSchema,
        tableColumnId: uuidSchema,
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      })
    )
    .min(1)
    .max(MAX_BATCH_SIZE),
  entrySource: z.nativeEnum(EntrySource).optional(),
});

// ─────────────────────────────────────────────────────────
// PATCH /api/tables/[id]/cells/batch
// Upsert multiple cell values in one transaction
// docs/features/03_ai_table_agent.md §5.3 (partial-commit semantics —
// the batch commits atomically; the client is responsible for only
// sending writes it wants committed, e.g. auto + resolved-disambiguation
// entries, never unresolved/parked ones)
// ─────────────────────────────────────────────────────────

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: tableId } = await params;
  const parsedTableId = uuidSchema.safeParse(tableId);

  if (!parsedTableId.success) {
    return apiError(`Invalid table ID format: ${tableId}`, 400);
  }

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  const table = await prisma.table.findFirst({
    where: { id: parsedTableId.data, ...ownershipWhere(user.id, orgIds) },
    select: { id: true },
  });
  if (!table) return apiError(`Table with ID ${parsedTableId.data} not found`, 404);

  const bodyResult = await parseBody(req, patchCellsBatchSchema);
  if (!bodyResult.success) {
    return bodyResult.errorResponse;
  }
  const { writes, entrySource } = bodyResult.data;

  try {
    const cells = await upsertCellsBatch({
      tableId: parsedTableId.data,
      userId: user.id,
      writes,
      entrySource,
    });
    return apiSuccess(cells, 200);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return apiError(error.message, 403);
      }
      if (error.message.includes("not found")) {
        return apiError(error.message, 404);
      }
      if (error.message.includes("does not belong")) {
        return apiError(error.message, 400);
      }
    }
    throw error;
  }
});
