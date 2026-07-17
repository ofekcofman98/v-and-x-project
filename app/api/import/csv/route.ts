/**
 * CSV Import API Route
 * Creates a BaseList (with entities) and a Table (with columns + cells) from
 * client-parsed CSV rows in a single transaction.
 * Based on: docs/features/08_csv_import_export.md
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma, EntrySource } from "@/lib/shared/generated/prisma/client";
import { withErrorHandler, parseBody, apiSuccess, apiError } from "@/lib/shared/utils/api";
import { ColumnType } from "@/lib/shared/types/column-types";
import { detectColumnType } from "@/lib/server/parsers/column-type-detector";
import { parseForColumn } from "@/lib/server/parsers/registry";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schema for request validation
// ─────────────────────────────────────────────────────────

const ImportCsvBody = z.object({
  tableName: z.string().min(1, "Table name is required"),
  headers: z.array(z.string().min(1)).min(1, "At least one column header is required"),
  rows: z.array(z.record(z.string(), z.string())).min(1, "At least one row is required"),
});

function toColumnKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "_");
}

interface ImportWarning {
  row: number;
  column: string;
  error: string;
}

// ─────────────────────────────────────────────────────────
// POST /api/import/csv
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req) => {
  const body = await parseBody(req, ImportCsvBody);
  if (!body.success) return body.errorResponse;

  const { tableName, headers, rows } = body.data;

  const uniqueHeaders = new Set(headers);
  if (uniqueHeaders.size !== headers.length) {
    return apiError("CSV headers must be unique", 400);
  }

  const columnDefs = headers.map((label) => ({
    key: toColumnKey(label),
    label,
    type: detectColumnType(rows.map((row) => row[label] ?? "")),
  }));

  const warnings: ImportWarning[] = [];

  const parsedRows = rows.map((row, rowIndex) => {
    const cellValues: Record<string, string | number | boolean | null> = {};

    for (const col of columnDefs) {
      const raw = row[col.label];
      const result = parseForColumn(
        raw === undefined || raw === "" ? null : raw,
        { type: col.type },
        { language: "auto" }
      );

      if (!result.valid) {
        warnings.push({ row: rowIndex + 1, column: col.label, error: result.error ?? "Invalid value" });
      }

      cellValues[col.key] = result.value as string | number | boolean | null;
    }

    return cellValues;
  });

  const result = await prisma.$transaction(async (tx) => {
    const baseList = await tx.baseList.create({
      data: {
        name: `${tableName} (Imported)`,
        schema: {
          columns: columnDefs.map((c) => ({ id: c.key, label: c.label, type: c.type })),
        } as Prisma.InputJsonValue,
        entities: {
          create: rows.map((_, rowIndex) => ({
            values: parsedRows[rowIndex] as Prisma.InputJsonValue,
          })),
        },
      },
      include: { entities: { orderBy: { createdAt: "asc" } } },
    });

    const table = await tx.table.create({
      data: {
        name: tableName,
        baseListId: baseList.id,
        representativeColumnKey: columnDefs[0].key,
        schema: { columns: [] } as Prisma.InputJsonValue,
        settings: {} as Prisma.InputJsonValue,
      },
    });

    await tx.tableColumn.createMany({
      data: columnDefs.map((col, index) => ({
        tableId: table.id,
        key: col.key,
        label: col.label,
        type: col.type as ColumnType,
        order: index,
      })),
    });

    const tableColumns = await tx.tableColumn.findMany({
      where: { tableId: table.id },
      orderBy: { order: "asc" },
    });

    await tx.tableCell.createMany({
      data: baseList.entities.flatMap((entity, rowIndex) =>
        tableColumns.map((col) => ({
          tableId: table.id,
          tableColumnId: col.id,
          entityId: entity.id,
          rowKey: entity.id,
          value: { value: parsedRows[rowIndex][col.key] } as Prisma.InputJsonValue,
          entrySource: EntrySource.MANUAL,
        }))
      ),
    });

    return { tableId: table.id, rowsImported: rows.length, columnsCreated: columnDefs.length };
  });

  return apiSuccess({ ...result, warnings: warnings.length > 0 ? warnings : undefined }, 201);
});
