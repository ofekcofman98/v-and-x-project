/**
 * Base List API Route
 * Handles creation of Base Lists with their entities in a single transaction.
 * Based on: docs/14_PRODUCT_DATA_FLOW.md §3 & §7.1
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────

const EntityFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "boolean"]),
  validation: z.record(z.string(), z.unknown()).optional(),
});

const BaseListSchemaField = z.object({
  columns: z.array(EntityFieldSchema).min(1),
});

const EntityValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

const CreateBaseListBody = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  schema: BaseListSchemaField,
  entities: z.array(z.object({ values: EntityValuesSchema })).default([]),
});

// ─────────────────────────────────────────────────────────
// POST /api/base-lists
// ─────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = CreateBaseListBody.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues
          .map((i) => i.message)
          .join(", "),
      },
      { status: 400 }
    );
  }

  const { name, description, schema, entities } = parsed.data;

  const baseList = await prisma.baseList.create({
    data: {
      name,
      description,
      schema: schema as Prisma.InputJsonValue,
      entities: {
        create: entities.map((e) => ({
          values: e.values as Prisma.InputJsonValue,
        })),
      },
    },
    include: { entities: true },
  });

  return NextResponse.json({ success: true, data: baseList }, { status: 201 });
}

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  const baseLists = await prisma.baseList.findMany();
  return NextResponse.json({ success: true, data: baseLists }, { status: 200 });
}