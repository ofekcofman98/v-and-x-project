'use client';

/**
 * Create BaseList Wizard - Step 1: General Info
 * Collects name and description for the new BaseList
 */

import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CreateBaseListFormData } from './types.ts';

interface Step1InfoProps {
  form: UseFormReturn<CreateBaseListFormData>;
}

export function Step1Info({ form }: Step1InfoProps) {
  const { register, formState: { errors } } = form;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">
          List Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          placeholder="e.g., Class 10A"
          {...register('name')}
          aria-invalid={errors.name ? 'true' : 'false'}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="e.g., Math class, Spring 2025"
          rows={3}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
        <p className="font-medium mb-1">What is a Base List?</p>
        <p className="text-blue-800 dark:text-blue-300">
          A Base List is a registry of entities (people, items, or things) that you want to track across multiple tables.
        </p>
      </div>
    </div>
  );
}
