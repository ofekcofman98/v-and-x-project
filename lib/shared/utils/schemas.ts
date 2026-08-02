// lib/utils/schemas.ts
import { z } from "zod";
import { ColumnType } from "@/lib/shared/types/column-types";
import { FORMULA_FUNCTIONS, MAX_FORMULA_REFERENCES } from "@/lib/shared/types/formula";

export const ColumnTypeSchema = z.nativeEnum(ColumnType);

export const ColumnFormulaSchema = z.object({
  type: z.enum(FORMULA_FUNCTIONS),
  references: z.array(z.string().min(1)).min(1).max(MAX_FORMULA_REFERENCES),
  precision: z.number().int().min(0).max(10).optional(),
  fallback: z.string().optional(),
});