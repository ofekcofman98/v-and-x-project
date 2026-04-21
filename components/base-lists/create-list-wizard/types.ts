/**
 * Type definitions for Create BaseList Wizard
 */

import { z } from 'zod';

export const columnSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Column name is required'),
  type: z.enum(['text', 'number', 'date', 'boolean']),
  validation: z.object({
    required: z.boolean().optional(),
  }).optional(),
});

export const entitySchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export const createBaseListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  columns: z.array(columnSchema).min(1, 'At least one column is required'),
  entities: z.array(entitySchema),
});

export type CreateBaseListFormData = z.infer<typeof createBaseListSchema>;
export type ColumnFormData = z.infer<typeof columnSchema>;
export type EntityFormData = z.infer<typeof entitySchema>;
