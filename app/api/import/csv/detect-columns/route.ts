/**
 * CSV Column Detection API Route
 * Stateless helper: infers column types from parsed CSV rows.
 * No database writes — CSV import produces a BaseList through the existing
 * DynamicListCreator + POST /api/base-lists flow (docs/14_PRODUCT_DATA_FLOW.md §3),
 * this endpoint only pre-fills the column-type selector for that grid.
 */

import { z } from "zod";
import { withErrorHandler, parseBody, apiSuccess } from "@/lib/shared/utils/api";
import { detectColumnType } from "@/lib/server/parsers/column-type-detector";

export const runtime = "nodejs";

const DetectColumnsBody = z.object({
  headers: z.array(z.string().min(1)).min(1, "At least one column header is required"),
  rows: z.array(z.record(z.string(), z.string())).min(1, "At least one row is required"),
});

function toColumnKey(label: string, occupied: Set<string>): string {
  const base = label.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "column";
  let key = base;
  let suffix = 1;
  while (occupied.has(key)) {
    key = `${base}_${++suffix}`;
  }
  occupied.add(key);
  return key;
}

export const POST = withErrorHandler(async (req) => {
  const body = await parseBody(req, DetectColumnsBody);
  if (!body.success) return body.errorResponse;

  const { headers, rows } = body.data;
  const occupiedKeys = new Set<string>();

  const columns = headers.map((label) => ({
    id: toColumnKey(label, occupiedKeys),
    label,
    type: detectColumnType(rows.map((row) => row[label] ?? "")),
  }));

  return apiSuccess({ columns }, 200);
});
