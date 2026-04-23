'use client';

/**
 * Create BaseList Wizard - Step 3: Data Entry
 * Dynamic table for entering entity data based on defined schema
 */

import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColumnType } from '@/lib/types/column-types';
import type { CreateBaseListFormData } from './types.ts';

interface Step3DataEntryProps {
  form: UseFormReturn<CreateBaseListFormData>;
}

export function Step3DataEntry({ form }: Step3DataEntryProps) {
  const { register, control, watch, formState: { errors } } = form;
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'entities',
  });

  const columns = watch('columns');

  const handleAddRow = () => {
    const emptyEntity: Record<string, string | number | boolean> = {};
    columns.forEach((col) => {
      emptyEntity[col.id] = '';
    });
    append({ values: emptyEntity });
  };

  const handleRemoveRow = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-4">Add Entities (Optional)</h3>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className="px-4 py-3 text-left text-sm font-medium"
                    >
                      {col.label || 'Unnamed'}
                    </th>
                  ))}
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fields.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      No entities yet. Click "Add Row" to get started.
                    </td>
                  </tr>
                ) : (
                  fields.map((field, rowIndex) => (
                    <tr key={field.id} className="hover:bg-muted/50">
                      {columns.map((col, colIndex) => (
                        <td key={col.id} className="px-4 py-2">
                          <Input
                            {...register(
                              `entities.${rowIndex}.values.${col.id}`
                            )}
                            type={
                              col.type === ColumnType.NUMBER
                                ? 'number'
                                : col.type === ColumnType.DATE
                                ? 'date'
                                : 'text'
                            }
                            placeholder={`Enter ${col.label.toLowerCase()}`}
                            className="h-9"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2">
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRow(rowIndex)}
                            className="h-9 w-9"
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleAddRow}
          className="mt-4"
        >
          <svg
            className="h-4 w-4 mr-2"
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
          Add Row
        </Button>
      </div>

      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
        <p className="font-medium mb-1">Data Entry Tips</p>
        <ul className="text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>You can skip this step and add entities later</li>
          <li>The table headers update automatically based on your schema</li>
          <li>Leave cells empty if you don't have the data yet</li>
        </ul>
      </div>
    </div>
  );
}
