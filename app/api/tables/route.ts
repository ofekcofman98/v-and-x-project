/**
 * Table API Route
 * Handles creation and retrieval of Tables (instances of BaseLists).
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §4 & §7.2
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/shared/generated/prisma/client";
import { withErrorHandler, parseBody, apiSuccess, apiError, apiInternalError } from "@/lib/shared/utils/api";
import { ColumnTypeSchema } from "@/lib/shared/utils/schemas";

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
  type: ColumnTypeSchema,
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


export const POST = withErrorHandler(
  async (req) => {
    const body = await parseBody(req, CreateTableBody);
    if (!body.success) return body.errorResponse;
    
    const { name, description, baseListId, representativeColumnKey, columns } = body.data;

    if (baseListId) {
        const baseList = await prisma.baseList.findUnique({
            where: { id: baseListId },
            select: { id: true, schema: true },
        });
        
        if (!baseList) {
            return apiError(`BaseList with id '${baseListId}' not found`, 404);
        }

        const baseListSchema = baseList.schema as { columns: Array<{ id: string }> };
        const hasRepColumn = baseListSchema.columns.some(
            (col) => col.id === representativeColumnKey
        );

        if (!hasRepColumn) {
            return apiError(`Representative column '${representativeColumnKey}' not found in BaseList schema`, 400);
        }
    }

    const result = await prisma.$transaction(async (tx) => {
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
        
        return {
            ...table,
            columns: tableColumns,
        };
    });

    return apiSuccess(result, 201);
  }
);

// ─────────────────────────────────────────────────────────
// GET /api/tables
// Fetch all tables with baseList name and column count
// ─────────────────────────────────────────────────────────


export const GET = withErrorHandler(
    async (req) => {
        const tables = await prisma.table.findMany({
            include: {
                baseList: {
                    select: {
                        id: true,
                        name: true 
                    },
                },
                _count: { 
                    select: { 
                        columns: true,
                    } 
                },
            },
            orderBy: { 
                createdAt: "desc" 
            },
        });
        return apiSuccess(tables, 200);
    }
);