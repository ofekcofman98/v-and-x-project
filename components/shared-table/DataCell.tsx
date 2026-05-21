'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnDef } from './types';
import { useState } from 'react';
import { GridSelect } from './GridSelect';

interface DataCellProps {
  column: ColumnDef;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DataCell({ column, value, onChange, disabled }: DataCellProps) {
  const [isFocused, setIsFocused] = useState(false);

  if (column.type === 'boolean') {
    return (
      <td className="border-l first:border-l-0 border-slate-200 p-1">
        <GridSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="h-8 text-sm"
          options={[
            { label: 'Yes', value: 'true' },
            { label: 'No', value: 'false' }
          ]}
        />
      </td>
    );
  }

  const inputType = column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text';
  const displayValue = value || '';

  return (
    <td className="border-l first:border-l-0 border-slate-200 p-0">
      <div className="relative">
        <input
          type={inputType}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder={isFocused ? 'Empty' : ''}
          className={`
            w-full h-9 px-2 py-1 text-sm bg-transparent border-none outline-none
            placeholder:text-slate-300
            hover:bg-slate-50
            focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-500
            transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
            ${!displayValue && !isFocused ? 'text-slate-300' : 'text-slate-900'}
          `}
        />
      </div>
    </td>
  );
}
