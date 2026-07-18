/**
 * Type definitions for Create BaseList Wizard
 */

import { z } from 'zod';
import { ColumnType } from '@/lib/shared/types/column-types';

const columnAccessSchema = z.object({
  visibility: z.enum(['public', 'private']),
  allowedRoles: z.array(z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'])).optional(),
  allowedUserIds: z.array(z.string()).optional(),
});

export const columnSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Column name is required'),
  type: z.nativeEnum(ColumnType),
  validation: z.object({
    required: z.boolean().optional(),
  }).optional(),
  access: columnAccessSchema.optional().nullable(),
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
