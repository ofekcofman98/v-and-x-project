/**
 * Column Template Dynamic Route
 * Handles fetching, updating, and deleting individual column templates.
 * Based on: docs/features/02_column_templates.md
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  apiError,
  apiSuccess,
  uuidSchema,
  withErrorHandler,
  parseBody,
} from "@/lib/utils/api";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────

const TemplateColumnSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "boolean"]),
  validation: z.record(z.string(), z.unknown()).optional(),
});

const TemplateSchemaField = z.object({
  columns: z.array(TemplateColumnSchema).min(1, "At least one column is required"),
});

const UpdateColumnTemplateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  schema: TemplateSchemaField.optional(),
  is_public: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────
// GET /api/column-templates/:id
// Fetches a single column template with full schema
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid template ID format", 400);

    const userId = req.headers.get("x-user-id");
    if (!userId) return apiError("Missing x-user-id header", 401);

    const template = await prisma.columnTemplate.findUnique({
      where: { id: parsedId.data },
    });

    if (!template) return apiError("Column template not found", 404);

    // Users can view their own templates or public ones
    if (template.userId !== userId && !template.isPublic) {
      return apiError("Column template not found", 404);
    }

    return apiSuccess({
      id: template.id,
      user_id: template.userId,
      organization_id: template.organizationId,
      name: template.name,
      description: template.description,
      category: template.category,
      schema: template.schema,
      is_public: template.isPublic,
      usage_count: template.usageCount,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    });
  }
);

// ─────────────────────────────────────────────────────────
// PATCH /api/column-templates/:id
// Updates a column template (owner only)
// ─────────────────────────────────────────────────────────

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid template ID format", 400);

    const userId = req.headers.get("x-user-id");
    if (!userId) return apiError("Missing x-user-id header", 401);

    const existing = await prisma.columnTemplate.findUnique({
      where: { id: parsedId.data },
      select: { userId: true },
    });

    if (!existing) return apiError("Column template not found", 404);
    if (existing.userId !== userId) return apiError("Forbidden", 403);

    const body = await parseBody(req, UpdateColumnTemplateBody);
    if (!body.success) return body.errorResponse;

    const { name, description, category, schema, is_public } = body.data;

    const updated = await prisma.columnTemplate.update({
      where: { id: parsedId.data },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(schema !== undefined && { schema: schema as unknown as Prisma.InputJsonValue }),
        ...(is_public !== undefined && { isPublic: is_public }),
      },
    });

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      category: updated.category,
      schema: updated.schema,
      is_public: updated.isPublic,
      usage_count: updated.usageCount,
      updated_at: updated.updatedAt,
    });
  }
);

// ─────────────────────────────────────────────────────────
// DELETE /api/column-templates/:id
// Deletes a column template (owner only)
// ─────────────────────────────────────────────────────────

export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid template ID format", 400);

    const userId = req.headers.get("x-user-id");
    if (!userId) return apiError("Missing x-user-id header", 401);

    const existing = await prisma.columnTemplate.findUnique({
      where: { id: parsedId.data },
      select: { userId: true },
    });

    if (!existing) return apiError("Column template not found", 404);
    if (existing.userId !== userId) return apiError("Forbidden", 403);

    await prisma.columnTemplate.delete({ where: { id: parsedId.data } });

    return apiSuccess({ id: parsedId.data });
  }
);
