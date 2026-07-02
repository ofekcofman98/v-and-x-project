/**
 * Apply Template to BaseList API Route
 * Applies a column template to an existing BaseList, merging or replacing columns.
 * Based on: docs/features/02_column_templates.md
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/shared/generated/prisma/client";
import { apiError, apiSuccess, uuidSchema, withErrorHandler, parseBody } from "@/lib/shared/utils/api";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────

const ApplyTemplateBody = z.object({
  templateId: z.string().uuid("Invalid template_id format"),
  autoSync: z.boolean().default(false),
  selectedBaseListColumnIds: z.array(z.string()).default([]),
});

const IDENTITY_COLUMN_KEYS = new Set(['name', 'id', 'identifier', 'key']);

function isIdentityColumn(col: { id: string; label: string }): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  return IDENTITY_COLUMN_KEYS.has(norm(col.id)) || IDENTITY_COLUMN_KEYS.has(norm(col.label));
}

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

    const { templateId, autoSync, selectedBaseListColumnIds } = body.data;

    const [baseList, template] = await Promise.all([
      prisma.baseList.findUnique({
        where: { id: parsedId.data },
        select: { id: true, name: true, schema: true },
      }),
      prisma.columnTemplate.findUnique({
        where: { id: templateId },
        select: { id: true, name: true, schema: true, isPublic: true, userId: true },
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

    const columnsToKeep = new Set(selectedBaseListColumnIds);

    const filteredBaseListColumns = baseListSchema.columns.filter((col) => {
      if (isIdentityColumn(col)) return true;
      return columnsToKeep.has(col.id);
    });

    const existingColumnIds = new Set(filteredBaseListColumns.map(c => c.id));
    const uniqueTemplateColumns = templateSchema.columns.filter((col) => {
      return !existingColumnIds.has(col.id);
    });

    const newColumns = [...filteredBaseListColumns, ...uniqueTemplateColumns];

    const columnsAdded = templateSchema.columns.length;
    const conflicts: any[] = [];

    // The representative column key defaults to the first identity column present
    // in the merged schema, falling back to the very first column's id.
    const representativeColumnKey =
      newColumns.find(isIdentityColumn)?.id ?? newColumns[0]?.id ?? "name";

    const tableName = `${baseList.name} - ${template.name}`;

    const [newTable] = await prisma.$transaction([
      prisma.table.create({
        data: {
          name: tableName,
          baseListId: parsedId.data,
          schema: { columns: newColumns } as unknown as Prisma.InputJsonValue,
          representativeColumnKey,
          settings: {} as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.baseListTemplate.upsert({
        where: {
          baseListId_templateId: {
            baseListId: parsedId.data,
            templateId: templateId,
          },
        },
        create: {
          baseListId: parsedId.data,
          templateId: templateId,
          autoSync: autoSync,
        },
        update: {
          autoSync: autoSync,
          appliedAt: new Date(),
        },
      }),
      prisma.columnTemplate.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    return apiSuccess({
      base_list_id: parsedId.data,
      table_id: newTable.id,
      table_name: newTable.name,
      template_applied: true,
      columns_added: columnsAdded,
      conflicts,
    });
  }
);
