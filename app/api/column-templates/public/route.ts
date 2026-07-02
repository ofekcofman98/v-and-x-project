/**
 * Public Column Templates API Route
 * Lists publicly available column templates (marketplace).
 * Based on: docs/features/02_column_templates.md
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/shared/generated/prisma/client";
import { apiSuccess, withErrorHandler } from "@/lib/shared/utils/api";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/column-templates/public
// List all public templates with optional category filter
// Query: ?category=education&page=1&per_page=20
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

  const where: Prisma.ColumnTemplateWhereInput = {
    isPublic: true,
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
      orderBy: { usageCount: "desc" },
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
