'use client';

import { Button } from '@/components/ui/button';
import { Trash2, Lock, Key, Calculator } from 'lucide-react';
import type { ColumnDef } from './types';

const FOREST = '#13501B';
const FOREST_DARK = '#0d3b14';
const FOREST_MUTED = '#e8f2e9';
const FOREST_SUBTLE = '#f2f8f2';

interface ColumnHeaderCellProps {
  column: ColumnDef;
  onNameChange: (name: string) => void;
  onTypeChange: (type: ColumnDef['type']) => void;
  onDelete: () => void;
  showTypeSelector?: boolean;
  isRepresentative?: boolean;
  onRepresentativeClick?: () => void;
  onAccessClick?: () => void;
}

export function ColumnHeaderCell({
  column,
  onNameChange,
  onDelete,
  isRepresentative = false,
  onRepresentativeClick,
  onAccessClick,
}: ColumnHeaderCellProps) {
  const isLocked = column.metadata?.locked || false;
  const isFromBaseList = column.metadata?.source === 'base_list';
  const isTextColumn = column.type === 'text';
  const isComputed = column.type === 'computed';
  const isPrivate = column.access?.visibility === 'private';

  return (
    <th
      className="border-l first:border-l-0 min-w-[180px] group transition-colors"
      style={{ background: isRepresentative ? FOREST_SUBTLE : '#f9fafb', borderColor: '#e5e7eb' }}
    >
      <div className="flex items-center justify-between p-2 gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {isTextColumn && onRepresentativeClick && (
            <Button
              onClick={onRepresentativeClick}
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0 transition-all"
              style={{ color: isRepresentative ? FOREST : '#9ca3af' }}
              title={isRepresentative ? 'Voice Key (Active)' : 'Set as Voice Key'}
            >
              <Key className="h-3.5 w-3.5" fill={isRepresentative ? FOREST : 'none'} />
            </Button>
          )}
          <input
            type="text"
            value={column.name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isLocked}
            placeholder="Column name"
            className="w-full bg-transparent border-none outline-none text-sm font-semibold placeholder:text-gray-400 placeholder:font-normal focus:bg-white focus:px-2 focus:py-1 focus:rounded focus:ring-2 transition-all disabled:opacity-50"
            style={{
              fontFamily: 'var(--font-display)',
              color: isRepresentative ? FOREST_DARK : '#374151',
            }}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isRepresentative && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ color: FOREST, background: FOREST_MUTED }}
            >
              Voice Key
            </span>
          )}
          {isFromBaseList && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ color: FOREST, background: FOREST_SUBTLE }}
            >
              Base List
            </span>
          )}
          {isComputed && (
            <Calculator className="h-3 w-3 text-gray-400 shrink-0" aria-label="Computed column" />
          )}
          {onAccessClick ? (
            <Button
              onClick={onAccessClick}
              size="icon"
              variant="ghost"
              className={`h-5 w-5 shrink-0 ${isPrivate ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title={isPrivate ? 'Private column — click to edit access' : 'Set column access'}
            >
              <Lock className="h-3 w-3" />
            </Button>
          ) : isLocked ? (
            <Lock className="h-3 w-3 text-gray-400" />
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
