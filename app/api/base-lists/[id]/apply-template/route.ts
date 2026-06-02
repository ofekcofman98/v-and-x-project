/**
 * Apply Template to BaseList API Route
 * Applies a column template to an existing BaseList, merging or replacing columns.
 * Based on: docs/features/02_column_templates.md
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { apiError, apiSuccess, uuidSchema, withErrorHandler, parseBody } from "@/lib/utils/api";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────

const ApplyTemplateBody = z.object({
  template_id: z.string().uuid("Invalid template_id format"),
  auto_sync: z.boolean().default(false),
  merge_strategy: z.enum(["append", "replace"]).default("append"),
});

// ─────────────────────────────────────────────────────────
// POST /api/base-lists/:id/apply-template
// Applies a column template's schema to the BaseList
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid BaseList ID format", 400);

    const body = await parseBody(req, ApplyTemplateBody);
    if (!body.success) return body.errorResponse;

    const { template_id, auto_sync, merge_strategy } = body.data;

    const [baseList, template] = await Promise.all([
      prisma.baseList.findUnique({
        where: { id: parsedId.data },
        select: { id: true, schema: true },
      }),
      prisma.columnTemplate.findUnique({
        where: { id: template_id },
        select: { id: true, schema: true, isPublic: true, userId: true },
      }),
    ]);

    if (!baseList) return apiError("BaseList not found", 404);
    if (!template) return apiError("Column template not found", 404);

    // Access check: user must own the template or it must be public
    const userId = req.headers.get("x-user-id");
    if (!userId) return apiError("Missing x-user-id header", 401);

    if (template.userId !== userId && !template.isPublic) {
      return apiError("Column template not found", 404);
    }

    const templateSchema = template.schema as { columns: Array<{ id: string; label: string; type: string }> };
    const baseListSchema = baseList.schema as { columns: Array<{ id: string; label: string; type: string }> };

    let newColumns: Array<{ id: string; label: string; type: string }>;
    const conflicts: Array<{ column_id: string; reason: string }> = [];

    if (merge_strategy === "replace") {
      newColumns = templateSchema.columns;
    } else {
      const existingIds = new Set(baseListSchema.columns.map((c) => c.id));
      newColumns = [...baseListSchema.columns];

      for (const col of templateSchema.columns) {
        if (existingIds.has(col.id)) {
          conflicts.push({ column_id: col.id, reason: "Column ID already exists in BaseList" });
        } else {
          newColumns.push(col);
        }
      }
    }

    const columnsAdded =
      merge_strategy === "replace"
        ? templateSchema.columns.length
        : templateSchema.columns.length - conflicts.length;

    await prisma.$transaction([
      prisma.baseList.update({
        where: { id: parsedId.data },
        data: { schema: { columns: newColumns } as unknown as Prisma.InputJsonValue },
      }),
      prisma.baseListTemplate.upsert({
        where: {
          baseListId_templateId: {
            baseListId: parsedId.data,
            templateId: template_id,
          },
        },
        create: {
          baseListId: parsedId.data,
          templateId: template_id,
          autoSync: auto_sync,
        },
        update: {
          autoSync: auto_sync,
          appliedAt: new Date(),
        },
      }),
      prisma.columnTemplate.update({
        where: { id: template_id },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    return apiSuccess({
      base_list_id: parsedId.data,
      template_applied: true,
      columns_added: columnsAdded,
      conflicts,
    });
  }
);
