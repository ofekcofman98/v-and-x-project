/**
 * Base List API Route
 * Handles creation of Base Lists with their entities in a single transaction.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §3 & §7.1
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { apiSuccess, apiError, apiInternalError, withErrorHandler, parseBody } from "@/lib/utils/api";
import { ColumnTypeSchema } from "@/lib/utils/schemas";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────

const EntityFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: ColumnTypeSchema,
  validation: z.record(z.string(), z.unknown()).optional(),
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
    const body = await parseBody(req, CreateBaseListBody);
    if (!body.success) return body.errorResponse;

    const { name, description, schema, entities } = body.data;

    const baseList = await prisma.baseList.create({
      data: {
        name,
        description,
        schema: schema as Prisma.InputJsonValue,
        entities: {
          create: entities.map((e) => ({
            values: e.values as Prisma.InputJsonValue,
          })),
        },
      },
      include: { entities: true },
    });
  
    return apiSuccess(baseList, 201);
  }
);

// ─────────────────────────────────────────────────────────
// GET /api/base-lists
// Fetch all base-lists
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(
  async (req) => {
    const baseLists = await prisma.baseList.findMany();
    return apiSuccess(baseLists, 200);
  }
);