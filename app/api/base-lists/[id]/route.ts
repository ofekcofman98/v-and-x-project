/**
 * Base List Dynamic Route
 * Handles fetching and deleting individual Base Lists.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §3 & §7.1
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, uuidSchema, withErrorHandler } from "@/lib/utils/api";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// GET /api/base-lists/:id
// Fetches a single BaseList with all associated entities
// ─────────────────────────────────────────────────────────


export const GET = withErrorHandler(async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;
    
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid BaseList ID format", 400);
  
    const baseList = await prisma.baseList.findUnique({
      where: { id: parsedId.data },
      include: { entities: true },
    });
  
    if (!baseList) return apiError("BaseList not found", 404);
  
    return apiSuccess(baseList);
  });

// ─────────────────────────────────────────────────────────
// DELETE /api/base-lists/:id
// Deletes a BaseList and cascades to all associated entities
// ─────────────────────────────────────────────────────────


export const DELETE = withErrorHandler(async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;
  
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return apiError("Invalid BaseList ID format", 400);
  
    const existingBaseList = await prisma.baseList.findUnique({
      where: { id: parsedId.data },
      select: { id: true },
    });
  
    if (!existingBaseList) return apiError("BaseList not found", 404);
  
    await prisma.baseList.delete({ where: { id: parsedId.data } });
  
    return apiSuccess({ id: parsedId.data });
  });