/**
 * Base List API Route
 * Handles creation of Base Lists with their entities in a single transaction.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §3 & §7.1
 */

import { z } from "zod";
import { apiSuccess, apiError, withErrorHandler, parseBody, uuidSchema } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { createBaseList, listBaseLists } from "@/lib/server/services/base-list-service";
import { OrgRole } from "@/lib/shared/generated/prisma/client";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────

const ColumnAccessSchema = z.object({
  visibility: z.enum(["public", "private"]),
  allowedRoles: z.array(z.nativeEnum(OrgRole)).optional(),
  allowedUserIds: z.array(uuidSchema).optional(),
});

// Base List columns cannot be computed — computed columns depend on Table
// cell data, and Base Lists have no cells of their own.
const EntityFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN"]),
  validation: z.record(z.string(), z.unknown()).optional(),
  access: ColumnAccessSchema.optional(),
});

const BaseListSchemaField = z.object({
  columns: z.array(EntityFieldSchema).min(1),
});

const EntityValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

const CreateBaseListBody = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  schema: BaseListSchemaField,
  entities: z.array(z.object({ values: EntityValuesSchema })).default([]),
});

// ─────────────────────────────────────────────────────────
// POST /api/base-lists
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(
  async (req) => {
    const user = await getAuthenticatedUser();
    if (!user) return apiError("Unauthorized", 401);

    const body = await parseBody(req, CreateBaseListBody);
    if (!body.success) return body.errorResponse;

    const baseList = await createBaseList({ userId: user.id, ...body.data });

    return apiSuccess(baseList, 201);
  }
);

// ─────────────────────────────────────────────────────────
// GET /api/base-lists
// Fetch all base-lists the user owns or has org access to
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(
  async (req) => {
    const user = await getAuthenticatedUser();
    if (!user) return apiError("Unauthorized", 401);

    const orgIds = await getAccessibleOrganizationIds(user.id);
    const baseLists = await listBaseLists(user.id, orgIds);
    return apiSuccess(baseLists, 200);
  }
);
