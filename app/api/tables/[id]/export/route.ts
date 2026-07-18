/**
 * Table Export API Route
 * Exports a table's rows to CSV.
 * Based on: docs/features/08_csv_import_export.md
 *
 * A table's columns are split across two sources — mirrors the column
 * resolution in app/dashboard/tables/[id]/page.tsx:
 * - table.schema.columns (JSONB) is authoritative when non-empty (covers
 *   apply-template tables, where base-list + template columns are merged).
 * - Otherwise, columns come from baseList.schema.columns (values live in
 *   ListEntity.values) plus the relational table.columns (values live in
 *   TableCell, keyed by tableColumnId).
 */

import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { apiError, withErrorHandler, uuidSchema } from "@/lib/shared/utils/api";
import { getCells } from "@/lib/server/services/cells";
import { getAuthenticatedUser, getAccessibleOrganizationIds, ownershipWhere } from "@/lib/server/services/auth";

export const runtime = "nodejs";

interface ExportColumn {
  id: string;
  label: string;
  isBaseColumn: boolean;
}

// ─────────────────────────────────────────────────────────
// GET /api/tables/[id]/export?format=csv
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return apiError(`Invalid table ID format: ${id}`, 400);

  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  if (format !== "csv") {
    return apiError(`Unsupported export format: ${format}`, 400);
  }

  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const orgIds = await getAccessibleOrganizationIds(user.id);
  const table = await prisma.table.findFirst({
    where: { id: parsedId.data, ...ownershipWhere(user.id, orgIds) },
    include: {
      columns: { orderBy: { order: "asc" } },
      baseList: { include: { entities: { orderBy: { createdAt: "asc" } } } },
    },
  });

  if (!table) return apiError(`Table with ID ${parsedId.data} not found`, 404);

  const baseListSchemaColumns =
    (table.baseList?.schema as { columns: Array<{ id: string; label: string }> } | null)?.columns ?? [];
  const baseListSchemaColumnIds = new Set(baseListSchemaColumns.map((c) => c.id));

  const tableSchemaColumns =
    (table.schema as { columns: Array<{ id: string; label: string }> } | null)?.columns ?? [];

  const columns: ExportColumn[] =
    tableSchemaColumns.length > 0
      ? tableSchemaColumns.map((col) => ({
          id: col.id,
          label: col.label,
          isBaseColumn: baseListSchemaColumnIds.has(col.id),
        }))
      : [
          ...baseListSchemaColumns.map((col) => ({ id: col.id, label: col.label, isBaseColumn: true })),
          ...table.columns.map((col) => ({ id: col.id, label: col.label, isBaseColumn: false })),
        ];

  const cells = await getCells({ tableId: parsedId.data });
  const cellValueByRowAndColumn = new Map<string, string>();
  for (const cell of cells) {
    const value = (cell.value as { value: string | number | boolean | null } | null)?.value;
    cellValueByRowAndColumn.set(
      `${cell.rowKey}::${cell.tableColumnId}`,
      value === null || value === undefined ? "" : String(value)
    );
  }

  const entities = table.baseList?.entities ?? [];
  // Rows come from the base list's entities (voice-pipeline architecture:
  // rows are entities, data columns are cells) when the table has one;
  // otherwise fall back to the distinct rowKeys present in the cells
  // themselves (standalone, non-baseList tables).
  const rowKeys =
    entities.length > 0 ? entities.map((e) => e.id) : Array.from(new Set(cells.map((c) => c.rowKey)));

  const entityById = new Map(entities.map((e) => [e.id, e]));

  const headers = columns.map((col) => col.label);
  const csvRows = rowKeys.map((rowKey) =>
    columns.map((col) => {
      if (col.isBaseColumn) {
        const entityValues = entityById.get(rowKey)?.values as Record<string, string | number | boolean | null> | undefined;
        const value = entityValues?.[col.id];
        return value === null || value === undefined ? "" : String(value);
      }
      return cellValueByRowAndColumn.get(`${rowKey}::${col.id}`) ?? "";
    })
  );

  const csv = Papa.unparse({ fields: headers, data: csvRows });
  const safeFileName = table.name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "table";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFileName}.csv"`,
    },
  });
});
