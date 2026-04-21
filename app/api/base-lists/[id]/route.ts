/**
 * Base List Dynamic Route
 * Handles fetching and deleting individual Base Lists.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §3 & §7.1
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/base-lists/:id
// Fetches a single BaseList with all associated entities
// ─────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "BaseList ID is required" },
      { status: 400 }
    );
  }

  try {
    const baseList = await prisma.baseList.findUnique({
      where: { id },
      include: { entities: true },
    });

    if (!baseList) {
      return NextResponse.json(
        { success: false, error: "BaseList not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: baseList },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching BaseList:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch BaseList" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/base-lists/:id
// Deletes a BaseList and cascades to all associated entities
// ─────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "BaseList ID is required" },
      { status: 400 }
    );
  }

  try {
    const baseList = await prisma.baseList.findUnique({
      where: { id },
    });

    if (!baseList) {
      return NextResponse.json(
        { success: false, error: "BaseList not found" },
        { status: 404 }
      );
    }

    await prisma.baseList.delete({
      where: { id },
    });

    return NextResponse.json(
      { success: true, data: { id } },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting BaseList:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete BaseList" },
      { status: 500 }
    );
  }
}
