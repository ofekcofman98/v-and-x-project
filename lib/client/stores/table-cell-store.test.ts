import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTableCellStore, cellKey } from './table-cell-store';

const initialState = useTableCellStore.getState();

// updateCell/updateCellsBatch guard on UUID-shaped ids (base-list column
// slugs must never reach the API), so fixtures need real UUID strings.
const ROW_1 = '11111111-1111-1111-1111-111111111111';
const ROW_2 = '22222222-2222-2222-2222-222222222222';
const ROW_3 = '33333333-3333-3333-3333-333333333333';
const COL_MATH = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const COL_ENGLISH = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const COL_SCIENCE = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

beforeEach(() => {
  useTableCellStore.setState(initialState, true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

describe('useTableCellStore justUpdatedCellKeys', () => {
  it('updateCell marks only the single written cell', async () => {
    await useTableCellStore.getState().updateCell('table-1', ROW_1, COL_MATH, 42);

    const { justUpdatedCellKeys } = useTableCellStore.getState();
    expect(justUpdatedCellKeys.size).toBe(1);
    expect(justUpdatedCellKeys.has(cellKey(ROW_1, COL_MATH))).toBe(true);
  });

  it('updateCellsBatch marks every written cell, not just the last', async () => {
    await useTableCellStore.getState().updateCellsBatch('table-1', [
      { rowKey: ROW_1, tableColumnId: COL_MATH, value: 90 },
      { rowKey: ROW_1, tableColumnId: COL_ENGLISH, value: 85 },
      { rowKey: ROW_1, tableColumnId: COL_SCIENCE, value: 70 },
      { rowKey: ROW_2, tableColumnId: COL_MATH, value: 70 },
      { rowKey: ROW_2, tableColumnId: COL_ENGLISH, value: 60 },
      { rowKey: ROW_2, tableColumnId: COL_SCIENCE, value: 55 },
    ]);

    const { justUpdatedCellKeys } = useTableCellStore.getState();
    expect(justUpdatedCellKeys.size).toBe(6);
    expect(justUpdatedCellKeys.has(cellKey(ROW_1, COL_MATH))).toBe(true);
    expect(justUpdatedCellKeys.has(cellKey(ROW_2, COL_SCIENCE))).toBe(true);
  });

  it('clearLastUpdated empties the set', async () => {
    await useTableCellStore.getState().updateCell('table-1', ROW_1, COL_MATH, 42);
    useTableCellStore.getState().clearLastUpdated();

    expect(useTableCellStore.getState().justUpdatedCellKeys.size).toBe(0);
  });

  it('a later single updateCell replaces the previous batch marks', async () => {
    await useTableCellStore.getState().updateCellsBatch('table-1', [
      { rowKey: ROW_1, tableColumnId: COL_MATH, value: 90 },
      { rowKey: ROW_2, tableColumnId: COL_MATH, value: 70 },
    ]);
    await useTableCellStore.getState().updateCell('table-1', ROW_3, COL_MATH, 55);

    const { justUpdatedCellKeys } = useTableCellStore.getState();
    expect(justUpdatedCellKeys.size).toBe(1);
    expect(justUpdatedCellKeys.has(cellKey(ROW_3, COL_MATH))).toBe(true);
  });
});
