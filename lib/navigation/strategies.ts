// lib/navigation/strategies.ts
import { TableSchema } from '@/lib/types/table-schema';
import { NavigationMode } from '../stores/ui-store';

export interface ActiveCell {
    rowId: string;
    columnId: string;
  }

  export interface NavigationStrategy {
    getNext: (
        current: ActiveCell,
        schema: TableSchema,
        rowIndexMap: Map<string, number>,
        colIndexMap: Map<string, number>
    ) => ActiveCell | null;

    getPrevious: (
        current: ActiveCell,
        schema: TableSchema,
        rowIndexMap: Map<string, number>,
        colIndexMap: Map<string, number>
    ) => ActiveCell | null;
  }

  function navigate(
    current: ActiveCell,
    schema: TableSchema,
    isRowFirst: boolean,
    rowIndexMap: Map<string, number>,
    colIndexMap: Map<string, number>,
    step: 1 | -1
  ): ActiveCell | null {
    const rowIndex = rowIndexMap.get(current.rowId);
    const colIndex = colIndexMap.get(current.columnId);

    if (rowIndex === undefined || colIndex === undefined) return null;

    const primaryIndex = isRowFirst ? colIndex : rowIndex;
    const secondaryIndex = isRowFirst ? rowIndex : colIndex;

    const primaryLimit = isRowFirst ? schema.columns.length : schema.rows.length;
    const secondaryLimit = isRowFirst ? schema.rows.length : schema.columns.length;

    let nextPrimaryIndex = primaryIndex + step;
    let nextSecondaryIndex = secondaryIndex;

    if (nextPrimaryIndex >= primaryLimit || nextPrimaryIndex < 0) {
        nextSecondaryIndex += step;
    
        if (nextSecondaryIndex >= secondaryLimit || nextSecondaryIndex < 0) {
            return null;
        }

        nextPrimaryIndex = step === 1 ? 0 : primaryLimit - 1;
    }
        
    const finalRowIndex = isRowFirst ? nextSecondaryIndex : nextPrimaryIndex;
    const finalColIndex = isRowFirst ? nextPrimaryIndex : nextSecondaryIndex;
    return {
        rowId: schema.rows[finalRowIndex].id,
        columnId: schema.columns[finalColIndex].id,
    };
  }
  
  const rowFirstStrategy: NavigationStrategy = {
    getNext: (current, schema, rowIndexMap, colIndexMap) => 
      navigate(current, schema, true, rowIndexMap, colIndexMap, 1),
    getPrevious: (current, schema, rowIndexMap, colIndexMap) => 
      navigate(current, schema, true, rowIndexMap, colIndexMap, -1),
  };

  const columnFirstStrategy: NavigationStrategy = {
    getNext: (current, schema, rowIndexMap, colIndexMap) => 
      navigate(current, schema, false, rowIndexMap, colIndexMap, 1),
    getPrevious: (current, schema, rowIndexMap, colIndexMap) => 
      navigate(current, schema, false, rowIndexMap, colIndexMap, -1),
  };

  export const navigationStrategies: Record<NavigationMode, NavigationStrategy> = {
    'row-first': rowFirstStrategy,
    'column-first': columnFirstStrategy,
  };