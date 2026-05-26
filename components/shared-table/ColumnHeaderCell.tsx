'use client';

import { Button } from '@/components/ui/button';
import { Trash2, Lock, Key } from 'lucide-react';
import type { ColumnDef } from './types';

interface ColumnHeaderCellProps {
  column: ColumnDef;
  onNameChange: (name: string) => void;
  onTypeChange: (type: ColumnDef['type']) => void;
  onDelete: () => void;
  showTypeSelector?: boolean;
  isRepresentative?: boolean;
  onRepresentativeClick?: () => void;
}

export function ColumnHeaderCell({
  column,
  onNameChange,
  onDelete,
  isRepresentative = false,
  onRepresentativeClick,
}: ColumnHeaderCellProps) {
  const isLocked = column.metadata?.locked || false;
  const isFromBaseList = column.metadata?.source === 'base_list';
  const isTextColumn = column.type === 'text';

  return (
    <th 
      className={`bg-slate-50 border-l first:border-l-0 border-slate-200 min-w-[180px] group transition-colors ${
        isRepresentative ? 'bg-blue-50/50' : ''
      }`}
    >
      <div className="flex items-center justify-between p-2 gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {isTextColumn && onRepresentativeClick && (
            <Button
              onClick={onRepresentativeClick}
              size="icon"
              variant="ghost"
              className={`h-5 w-5 shrink-0 transition-all ${
                isRepresentative
                  ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={isRepresentative ? 'Voice Key (Active)' : 'Set as Voice Key'}
            >
              <Key className={`h-3.5 w-3.5 ${isRepresentative ? 'fill-blue-600' : ''}`} />
            </Button>
          )}
          <input
            type="text"
            value={column.name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isLocked}
            placeholder="Column name"
            className={`w-full bg-transparent border-none outline-none text-sm font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:px-2 focus:py-1 focus:rounded focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 ${
              isRepresentative ? 'text-blue-900' : ''
            }`}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isRepresentative && (
            <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
              Voice Key
            </span>
          )}
          {isFromBaseList && (
            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              Base List
            </span>
          )}
          {isLocked ? (
            <Lock className="h-3 w-3 text-slate-400" />
          ) : (
            <Button
              onClick={onDelete}
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </th>
  );
}
