/**
 * PATCH /api/tables/[id]/representative-column
 * Updates the Voice Key (representative column) for a table.
 * The chosen column must belong to the table's linked BaseList schema.
 * Based on: docs/features/01_cache_warming.md § API Contract
 */

import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  withErrorHandler,
  uuidSchema,
  parseBody,
} from "@/lib/shared/utils/api";

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

  const body = await parseBody(req, patchSchema);
  if (!body.success) return body.errorResponse;

  const { representative_column } = body.data;

  // Load the table with its BaseList schema to validate the column key
  const table = await prisma.table.findUnique({
    where: { id: parsedId.data },
    select: {
      id: true,
      representativeColumnKey: true,
      baseList: { select: { schema: true } },
    },
  });

  if (!table) return apiError(`Table with ID ${parsedId.data} not found`, 404);

  // Validate that the chosen key exists as a column in the BaseList schema
  if (table.baseList) {
    const schema = table.baseList.schema as { columns?: { id: string }[] };
    const validColumnIds = (schema.columns ?? []).map((c) => c.id);
    if (!validColumnIds.includes(representative_column)) {
      return apiError(
        `Column '${representative_column}' is not a valid Base List column for this table`,
        422,
      );
    }
  }

  const updated = await prisma.table.update({
    where: { id: parsedId.data },
    data: { representativeColumnKey: representative_column },
    select: {
      id: true,
      representativeColumnKey: true,
    },
  });

  return apiSuccess({
    id: updated.id,
    representative_column: updated.representativeColumnKey,
  });
});
