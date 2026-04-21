/**
 * Table API Route
 * Handles creation and retrieval of Tables (instances of BaseLists).
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §4 & §7.2
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas for request validation
// ─────────────────────────────────────────────────────────

/**
 * Schema for a single column in the table
 * Example: { label: "Score", type: "NUMBER" }
 */
const ColumnSchema = z.object({
  label: z.string().min(1, "Column label is required"),
  type: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN"]),
  validation: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for creating a new table
 */
const CreateTableBody = z.object({
  name: z.string().min(1, "Table name is required"),
  description: z.string().optional(),
  baseListId: z.string().uuid("Invalid baseListId format").optional(),
  representativeColumnKey: z.string().min(1, "Representative column key is required"),
  columns: z.array(ColumnSchema).min(1, "At least one data column is required"),
});

// ─────────────────────────────────────────────────────────
// POST /api/tables
// Create a new table with its columns in a transaction
// ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate request body
  const parsed = CreateTableBody.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      },
      { status: 400 }
    );
  }

  const { name, description, baseListId, representativeColumnKey, columns } =
    parsed.data;

  try {
    // STEP 1: Validate that the baseListId exists (if provided)
    if (baseListId) {
      const baseList = await prisma.baseList.findUnique({
        where: { id: baseListId },
        select: { id: true, schema: true },
      });

      if (!baseList) {
        return NextResponse.json(
          { success: false, error: `BaseList with id '${baseListId}' not found` },
          { status: 404 }
        );
      }

      // STEP 2: Validate that representativeColumnKey exists in BaseList schema
      const baseListSchema = baseList.schema as { columns: Array<{ id: string }> };
      const hasRepColumn = baseListSchema.columns.some(
        (col) => col.id === representativeColumnKey
      );

      if (!hasRepColumn) {
        return NextResponse.json(
          {
            success: false,
            error: `Representative column '${representativeColumnKey}' not found in BaseList schema`,
          },
          { status: 400 }
        );
      }
    }

    // STEP 3: Use Prisma transaction to create Table + TableColumns atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create the Table
      const table = await tx.table.create({
        data: {
          name,
          description,
          baseListId,
          representativeColumnKey,
          schema: { columns: [] } as Prisma.InputJsonValue,
          settings: {} as Prisma.InputJsonValue,
        },
      });

      // Create TableColumn records for each data column
      const tableColumns = await Promise.all(
        columns.map((col, index) =>
          tx.tableColumn.create({
            data: {
              tableId: table.id,
              key: col.label.toLowerCase().replace(/\s+/g, "_"),
              label: col.label,
              type: col.type,
              order: index,
              validation: col.validation
                ? (col.validation as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            },
          })
        )
      );

      // Return table with its columns
      return {
        ...table,
        columns: tableColumns,
      };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Error creating table:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create table",
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// GET /api/tables
// Fetch all tables with baseList name and column count
// ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tables = await prisma.table.findMany({
      include: {
        baseList: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            columns: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, data: tables }, { status: 200 });
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch tables",
      },
      { status: 500 }
    );
  }
}
