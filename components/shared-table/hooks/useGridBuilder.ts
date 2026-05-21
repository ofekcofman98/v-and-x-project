import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useColumnManager } from './useColumnManager';
import { useRowManager } from './useRowManager';
import type { ColumnDef, RowData } from '../types';

/**
 * useGridBuilder - A unified hook to manage Form state and Grid logic
 * Prevents duplication between Base List Creator and Table Creator
 */
export function useGridBuilder(defaultColumn?: ColumnDef) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const initialColumns = defaultColumn ? [defaultColumn] : [];
    const { columns, setColumns, addColumn, updateColumn, removeColumn } = useColumnManager(initialColumns);

    const { rows, setRows, addRow, updateCell, removeRow } = useRowManager(
        [{ id: 'row_1', values: {}, metadata: { source: 'inline' } }], 
        columns
    );

    const handleAddColumn = () => {
        addColumn({
          id: `col_${Date.now()}`,
          name: '',
          type: 'text',
          metadata: { source: 'user_defined', locked: false },
        });
    };

    const handleRemoveColumn = (colId: string) => {
        if (columns.length === 1) {
          toast({ title: 'Cannot Delete', description: 'At least one column is required.', variant: 'destructive' });
          return;
        }
    
        const col = columns.find((c) => c.id === colId);
        if (col?.metadata?.locked) {
          toast({ title: 'Cannot Delete', description: 'This column is locked.', variant: 'destructive' });
          return;
        }
    
        const success = removeColumn(colId);
        if (success) {
          // Clear column data from all rows
          setRows((currentRows) => currentRows.map((row) => {
            const { [colId]: _, ...rest } = row.values;
            return { ...row, values: rest };
          }));
        }
    };

    const handleAddRow = () => {
        addRow({
          id: `row_${Date.now()}`,
          values: {},
          metadata: { source: 'inline' },
        });
    };

    const handleRemoveRow = (rowId: string) => {
        if (rows.length === 1) {
          toast({ title: 'Cannot Delete', description: 'At least one row must be present.', variant: 'destructive' });
          return;
        }
    
        const row = rows.find((r) => r.id === rowId);
        if (row?.metadata?.locked) {
          toast({ title: 'Cannot Delete', description: 'This row is locked.', variant: 'destructive' });
          return;
        }
        
        removeRow(rowId);
    };

    return {
        state: { name, description, isSubmitting, columns, rows },
        setters: { setName, setDescription, setIsSubmitting, setColumns, setRows },
        gridActions: { 
          onAddColumn: handleAddColumn, 
          onRemoveColumn: handleRemoveColumn, 
          onUpdateColumn: updateColumn, 
          onAddRow: handleAddRow, 
          onRemoveRow: handleRemoveRow, 
          onUpdateCell: updateCell 
        }
    };
}