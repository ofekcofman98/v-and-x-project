'use client';

/**
 * Create BaseList Wizard - Step 2: Schema Definition
 * Allows users to define columns for the BaseList
 */

import { UseFormReturn, useFieldArray } from 'react-hook-form';
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
import { ColumnType } from '@/lib/shared/types/column-types.js';
import type { CreateBaseListFormData } from './types.ts';

interface Step2SchemaProps {
  form: UseFormReturn<CreateBaseListFormData>;
}

export function Step2Schema({ form }: Step2SchemaProps) {
  const { register, control, formState: { errors }, watch, setValue } = form;
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columns',
  });

  const handleAddColumn = () => {
    append({
      id: `col_${Date.now()}`,
      label: '',
      type: ColumnType.TEXT,
    });
  };

  const handleRemoveColumn = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Define Columns</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddColumn}
          >
            <svg
              className="h-4 w-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Column
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex gap-2 items-start p-3 rounded-lg border bg-card"
            >
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`columns.${index}.label`} className="sr-only">
                      Column Label
                    </Label>
                    <Input
                      id={`columns.${index}.label`}
                      placeholder="Column name (e.g., Student Name)"
                      {...register(`columns.${index}.label`)}
                      disabled={index === 0}
                    />
                    {errors.columns?.[index]?.label && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.columns[index]?.label?.message}
                      </p>
                    )}
                  </div>

                  <div className="w-32">
                    <Label htmlFor={`columns.${index}.type`} className="sr-only">
                      Column Type
                    </Label>
                    <Select
                      value={watch(`columns.${index}.type`)}
                      onValueChange={(value) =>
                        setValue(`columns.${index}.type`, value as ColumnType)
                      }
                      disabled={index === 0}
                    >
                      <SelectTrigger id={`columns.${index}.type`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ColumnType.TEXT}>Text</SelectItem>
                        <SelectItem value={ColumnType.NUMBER}>Number</SelectItem>
                        <SelectItem value={ColumnType.DATE}>Date</SelectItem>
                        <SelectItem value={ColumnType.BOOLEAN}>Yes/No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {index === 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <svg
                      className="h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Default column (locked)
                  </p>
                )}
              </div>

              {fields.length > 1 && index !== 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveColumn(index)}
                  className="shrink-0"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
        <p className="font-medium mb-1">Schema Design Tips</p>
        <ul className="text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>The first column (Name) is locked and will be used as the primary identifier</li>
          <li>Add additional columns to store entity attributes (ID, Email, etc.)</li>
          <li>You can reorder and modify columns later</li>
        </ul>
      </div>
    </div>
  );
}
