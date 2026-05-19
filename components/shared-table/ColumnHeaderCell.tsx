'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Lock } from 'lucide-react';
import type { ColumnDef } from './types';

interface ColumnHeaderCellProps {
  column: ColumnDef;
  onNameChange: (name: string) => void;
  onTypeChange: (type: ColumnDef['type']) => void;
  onDelete: () => void;
  showTypeSelector?: boolean;
}

export function ColumnHeaderCell({
  column,
  onNameChange,
  onTypeChange,
  onDelete,
  showTypeSelector = true,
}: ColumnHeaderCellProps) {
  const isLocked = column.metadata?.locked || false;
  const isFromBaseList = column.metadata?.source === 'base_list';

  return (
    <th className="bg-slate-50 border-l first:border-l-0 border-slate-200 min-w-[180px] group">
      <div className="flex items-center justify-between p-2 gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={column.name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isLocked}
            placeholder="Column name"
            className="w-full bg-transparent border-none outline-none text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:px-2 focus:py-1 focus:rounded focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
          />
        </div>
        {isLocked ? (
          <Lock className="h-3 w-3 text-slate-400 shrink-0" />
        ) : (
          <Button
            onClick={onDelete}
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        {isFromBaseList && (
          <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
            Base List
          </span>
        )}
      </div>
    </th>
  );
}
