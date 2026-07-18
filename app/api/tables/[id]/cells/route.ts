import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, withErrorHandler, uuidSchema, parseBody } from "@/lib/shared/utils/api";
import { upsertCell, getCells } from "@/lib/server/services/cells";
import { EntrySource } from "@/lib/shared/generated/prisma/client";
import { getAuthenticatedUser, getAccessibleOrganizationIds, ownershipWhere } from "@/lib/server/services/auth";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Request body schema
// ─────────────────────────────────────────────────────────

const patchCellSchema = z.object({
    rowKey: uuidSchema,
    tableColumnId: uuidSchema,
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    entityId: uuidSchema.optional().nullable(),
    entrySource: z.nativeEnum(EntrySource).optional(),
  });
  
type PatchCellBody = z.infer<typeof patchCellSchema>;

const getCellsQuerySchema = z.object({
    rowKey: uuidSchema.optional(),
  });


// ─────────────────────────────────────────────────────────
// PATCH /api/tables/[id]/cells
// Upsert a single cell value
// ─────────────────────────────────────────────────────────


export const PATCH = withErrorHandler(async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    // Extract and validate table ID from URL params
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

    // Parse and validate request body
    const bodyResult = await parseBody(req, patchCellSchema);
    if (!bodyResult.success) {
      return bodyResult.errorResponse;
    }
    const { rowKey, tableColumnId, value, entityId, entrySource } = bodyResult.data;
    // Upsert the cell
    try {
      const cell = await upsertCell({
        tableId: parsedTableId.data,
        rowKey,
        tableColumnId,
        value,
        entityId,
        entrySource,
      });
      return apiSuccess(cell, 200);
    } catch (error) {
      // Handle known errors with appropriate status codes
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return apiError(error.message, 404);
        }
        if (error.message.includes("does not belong")) {
          return apiError(error.message, 400);
        }
      }
      // Re-throw for withErrorHandler to catch as 500
      throw error;
    }
  });
  
// ─────────────────────────────────────────────────────────
// GET /api/tables/[id]/cells?rowKey=xxx (optional)
// Fetch all cells for a table, optionally filtered by row
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (
    req: NextRequest,
    { params } : { params: Promise<{ id: string }> }
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

    // Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const rowKey = searchParams.get('rowKey') || undefined;

    const queryResult = getCellsQuerySchema.safeParse({ rowKey });
    if (!queryResult.success) {
      return apiError(`Invalid query parameters: ${queryResult.error.message}`, 400);
    }
  
    // Fetch cells
    try {
        const cells = await getCells({
            tableId: parsedTableId.data,
            rowKey: queryResult.data.rowKey,
        });
        
        return apiSuccess(cells, 200);
    } catch (error) {
        // Handle known errors
        if (error instanceof Error && error.message.includes("not found")) {
        return apiError(error.message, 404);
        }
        // Re-throw for withErrorHandler to catch as 500
        throw error;
    }
});