/**
 * Column Templates API Route
 * Handles creation and listing of reusable column schema templates.
 * Based on: docs/features/02_column_templates.md
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/shared/generated/prisma/client";
import { apiSuccess, apiError, withErrorHandler, parseBody } from "@/lib/shared/utils/api";
import { ColumnFormulaSchema } from "@/lib/shared/utils/schemas";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────

const TemplateColumnSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "boolean", "computed"]),
  validation: z.record(z.string(), z.unknown()).optional(),
  formula: ColumnFormulaSchema.optional(),
});

const TemplateSchemaField = z.object({
  columns: z.array(TemplateColumnSchema).min(1, "At least one column is required"),
});

const CreateColumnTemplateBody = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  schema: TemplateSchemaField,
  is_public: z.boolean().default(false),
});

// ─────────────────────────────────────────────────────────
// POST /api/column-templates
// Create a new column template
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req) => {
  const body = await parseBody(req, CreateColumnTemplateBody);
  if (!body.success) return body.errorResponse;

  const { name, description, category, schema, is_public } = body.data;

  // TODO: Replace with actual auth user ID from session
  const userId = req.headers.get("x-user-id");
  if (!userId) return apiError("Missing x-user-id header", 401);

  const template = await prisma.columnTemplate.create({
    data: {
      userId,
      name,
      description,
      category,
      schema: schema as unknown as Prisma.InputJsonValue,
      isPublic: is_public,
    },
  });

  return apiSuccess(
    {
      id: template.id,
      name: template.name,
      usage_count: template.usageCount,
      created_at: template.createdAt,
    },
    201
  );
});

// ─────────────────────────────────────────────────────────
// GET /api/column-templates
// List user's own templates with optional filters
// Query: ?category=education&page=1&per_page=20
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (req) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) return apiError("Missing x-user-id header", 401);

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

  const where: Prisma.ColumnTemplateWhereInput = {
    userId,
    ...(category && { category }),
  };

  const [templates, total] = await Promise.all([
    prisma.columnTemplate.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        isPublic: true,
        usageCount: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.columnTemplate.count({ where }),
  ]);

  return apiSuccess({
    data: templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      is_public: t.isPublic,
      usage_count: t.usageCount,
    })),
    pagination: {
      total,
      page,
      per_page: perPage,
    },
  });
});
