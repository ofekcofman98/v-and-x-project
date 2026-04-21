/**
 * Dynamic Table API Route
 * Handles fetching and deletion of individual tables.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §4 & §7.2
 * 
 * CRITICAL: GET includes both table columns AND baseList entities
 * for Grid UI rendering (rows come from BaseList, data columns from Table)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/tables/[id]
// Fetch a single table with its columns and parent BaseList entities
// ─────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
): Promise<NextResponse> {
  // Await params if it's a Promise (Next.js 15+)
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid table ID format" },
      { status: 400 }
    );
  }

  try {
    const table = await prisma.table.findUnique({
      where: { id },
      include: {
        // Include all table columns, ordered by their display order
        columns: {
          orderBy: { order: "asc" },
        },
        // Include the parent BaseList with ALL its entities
        // This is CRITICAL for Grid UI: we need the entity names (rows)
        baseList: {
          include: {
            entities: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json(
        { success: false, error: `Table with id '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: table }, { status: 200 });
  } catch (error) {
    console.error("Error fetching table:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch table",
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/tables/[id]
// Delete a table and all its associated records
// ─────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
): Promise<NextResponse> {
  // Await params if it's a Promise (Next.js 15+)
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid table ID format" },
      { status: 400 }
    );
  }

  try {
    // Check if table exists first
    const existingTable = await prisma.table.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existingTable) {
      return NextResponse.json(
        { success: false, error: `Table with id '${id}' not found` },
        { status: 404 }
      );
    }

    // Delete the table (CASCADE will handle related records)
    // Per schema: TableColumn and TableCell will be deleted automatically
    await prisma.table.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Table '${existingTable.name}' deleted successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting table:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete table",
      },
      { status: 500 }
    );
  }
}
