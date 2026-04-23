/**
 * Create Table Dialog
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §4.1
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useBaseListStore } from '@/lib/stores/base-list-store';
import { useTableStore } from '@/lib/stores/table-store';
import { toast } from '@/components/ui/use-toast';
import type { BaseListColumn } from '@/lib/types/models';

// ─────────────────────────────────────────────────────────
// Form Schema
// ─────────────────────────────────────────────────────────

const columnSchema = z.object({
  label: z.string().min(1, 'Column label is required'),
  type: z.enum(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN']),
});

const formSchema = z.object({
  name: z.string().min(1, 'Table name is required'),
  baseListId: z.string().uuid('Please select a base list'),
  representativeColumnKey: z.string().min(1, 'Please select a representative column'),
  columns: z.array(columnSchema).min(1, 'At least one data column is required'),
});

type FormData = z.infer<typeof formSchema>;

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBaseListId?: string;
}

export function CreateTableDialog({ open, onOpenChange, defaultBaseListId }: CreateTableDialogProps) {
  const { lists, fetchLists } = useBaseListStore();
  const { addTable, fetchTables } = useTableStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Available columns for the selected BaseList
  const [availableColumns, setAvailableColumns] = useState<BaseListColumn[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      baseListId: '',
      representativeColumnKey: '',
      columns: [{ label: '', type: 'TEXT' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columns',
  });

  // Watch the selected baseListId to update available columns
  const selectedBaseListId = watch('baseListId');

  // Load BaseLists on mount
  useEffect(() => {
    if (open) {
      fetchLists();
    }
  }, [open, fetchLists]);

  // Update available columns when BaseList selection changes
  useEffect(() => {
    if (selectedBaseListId) {
      const selectedList = lists.find((list) => list.id === selectedBaseListId);
      if (selectedList) {
        setAvailableColumns(selectedList.schema.columns);
        // Reset representative column selection when BaseList changes
        setValue('representativeColumnKey', '');
      }
    } else {
      setAvailableColumns([]);
      setValue('representativeColumnKey', '');
    }
  }, [selectedBaseListId, lists, setValue]);

  // Initialize form with defaultBaseListId when dialog opens
  useEffect(() => {
    if (open && defaultBaseListId && lists.length > 0) {
      const listExists = lists.find((list) => list.id === defaultBaseListId);
      if (listExists) {
        setValue('baseListId', defaultBaseListId);
      }
    }
  }, [open, defaultBaseListId, lists, setValue]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          baseListId: data.baseListId,
          representativeColumnKey: data.representativeColumnKey,
          columns: data.columns,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create table' }));
        throw new Error(errorData.error || 'Failed to create table');
      }

      const result = await response.json();
      const newTable = result.data;

      // Update store
      addTable(newTable);
      
      // Optionally refresh the full list
      await fetchTables();

      // Show success toast
      toast({
        title: 'Table created successfully',
        description: `"${data.name}" is now ready for data entry.`,
      });

      // Close dialog and reset form
      onOpenChange(false);
      reset();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error creating table',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Table Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Table Name</Label>
            <Input
              id="name"
              placeholder="e.g., Math Exam Q1"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Base List Selection */}
          <div className="space-y-2">
            <Label htmlFor="baseListId">Base List</Label>
            <Select
              value={watch('baseListId')}
              onValueChange={(value) => setValue('baseListId', value)}
            >
              <SelectTrigger id="baseListId">
                <SelectValue placeholder="Select a base list" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.baseListId && (
              <p className="text-sm text-red-500">{errors.baseListId.message}</p>
            )}
          </div>

          {/* Representative Column Selection */}
          {availableColumns.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="representativeColumnKey">Representative Column</Label>
              <Select
                value={watch('representativeColumnKey')}
                onValueChange={(value) => setValue('representativeColumnKey', value)}
              >
                <SelectTrigger id="representativeColumnKey">
                  <SelectValue placeholder="Select the column for entity matching" />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.representativeColumnKey && (
                <p className="text-sm text-red-500">{errors.representativeColumnKey.message}</p>
              )}
              <p className="text-sm text-gray-500">
                This column will be used for voice entity matching (e.g., "Alice, 92")
              </p>
            </div>
          )}

          {/* Data Columns */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Data Columns</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ label: '', type: 'TEXT' })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Column
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-4 items-start">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="e.g., Score"
                    {...register(`columns.${index}.label`)}
                  />
                  {errors.columns?.[index]?.label && (
                    <p className="text-sm text-red-500">
                      {errors.columns[index]?.label?.message}
                    </p>
                  )}
                </div>

                <div className="w-40 space-y-2">
                  <Select
                    value={watch(`columns.${index}.type`)}
                    onValueChange={(value) =>
                      setValue(`columns.${index}.type` as any, value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="NUMBER">Number</SelectItem>
                      <SelectItem value="DATE">Date</SelectItem>
                      <SelectItem value="BOOLEAN">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}

            {errors.columns && !Array.isArray(errors.columns) && (
              <p className="text-sm text-red-500">{errors.columns.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Table'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
