// lib/utils/schemas.ts
import { z } from "zod";
import { ColumnType } from "@/lib/shared/types/column-types";

export const ColumnTypeSchema = z.nativeEnum(ColumnType);