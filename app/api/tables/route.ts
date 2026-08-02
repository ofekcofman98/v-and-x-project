/**
 * Table API Route
 * Handles creation and retrieval of Tables (instances of BaseLists).
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §4 & §7.2
 */

import { z } from "zod";
import { withErrorHandler, parseBody, apiSuccess, apiError, uuidSchema } from "@/lib/shared/utils/api";
import { ColumnTypeSchema, ColumnFormulaSchema } from "@/lib/shared/utils/schemas";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { createTable, listTables } from "@/lib/server/services/table-service";
import { OrgRole } from "@/lib/shared/generated/prisma/client";
import { ColumnType } from "@/lib/shared/types/column-types";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas for request validation
// ─────────────────────────────────────────────────────────

/**
 * Schema for a single column in the table
 * Example: { label: "Score", type: "NUMBER" }
 */
const ColumnAccessSchema = z.object({
  visibility: z.enum(["public", "private"]),
  allowedRoles: z.array(z.nativeEnum(OrgRole)).optional(),
  allowedUserIds: z.array(uuidSchema).optional(),
});

const ColumnSchema = z
  .object({
    label: z.string().min(1, "Column label is required"),
    type: ColumnTypeSchema,
    validation: z.record(z.string(), z.unknown()).optional(),
    access: ColumnAccessSchema.optional(),
    formula: ColumnFormulaSchema.optional(),
  })
  .refine((col) => col.type !== ColumnType.COMPUTED || col.formula !== undefined, {
    message: "Computed columns require a formula",
    path: ["formula"],
  });

/**
 * Schema for creating a new table
 */
const CreateTableBody = z.object({
  name: z.string().min(1, "Table name is required"),
  description: z.string().optional(),
  baseListId: z.string().uuid("Invalid baseListId format").optional(),
  representativeColumnKey: z.string().min(1, "Representative column key is required"),
  columns: z.array(ColumnSchema).min(1, "At least one data column is required"),
});

// ─────────────────────────────────────────────────────────
// POST /api/tables
// Create a new table with its columns in a transaction
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(
  async (req) => {
    const user = await getAuthenticatedUser();
    if (!user) return apiError("Unauthorized", 401);

    const body = await parseBody(req, CreateTableBody);
    if (!body.success) return body.errorResponse;

    const orgIds = await getAccessibleOrganizationIds(user.id);
    try {
      const result = await createTable({ userId: user.id, organizationIds: orgIds, ...body.data });
      return apiSuccess(result, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return apiError(error.message, 404);
      }
      if (error instanceof Error && error.message.includes("Representative column")) {
        return apiError(error.message, 400);
      }
      if (error instanceof Error && error.message.startsWith("Invalid formula:")) {
        return apiError(error.message, 400);
      }
      throw error;
    }
  }
);

// ─────────────────────────────────────────────────────────
// GET /api/tables
// Fetch all tables with baseList name and column count
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(
    async (req) => {
        const user = await getAuthenticatedUser();
        if (!user) return apiError("Unauthorized", 401);

        const orgIds = await getAccessibleOrganizationIds(user.id);
        const tables = await listTables(user.id, orgIds);
        return apiSuccess(tables, 200);
    }
);
