/**
 * BaseList Templates API Route
 * Lists all templates applied to a specific BaseList.
 * Based on: docs/features/02_column_templates.md
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, uuidSchema, withErrorHandler } from "@/lib/shared/utils/api";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/base-lists/:id/templates
// Returns all templates that have been applied to this BaseList
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid BaseList ID format", 400);

    const baseList = await prisma.baseList.findUnique({
      where: { id: parsedId.data },
      select: { id: true },
    });

    if (!baseList) return apiError("BaseList not found", 404);

    const applied = await prisma.baseListTemplate.findMany({
      where: { baseListId: parsedId.data },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            schema: true,
            isPublic: true,
          },
        },
      },
      orderBy: { appliedAt: "desc" },
    });

    return apiSuccess(
      applied.map((entry) => ({
        id: entry.id,
        template_id: entry.template.id,
        template_name: entry.template.name,
        template_description: entry.template.description,
        template_category: entry.template.category,
        template_schema: entry.template.schema,
        is_public: entry.template.isPublic,
        auto_sync: entry.autoSync,
        applied_at: entry.appliedAt,
      }))
    );
  }
);
