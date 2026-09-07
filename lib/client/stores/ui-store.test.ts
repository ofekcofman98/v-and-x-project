import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore, resolveSelectionCells } from './ui-store';

const initialState = useUIStore.getState();

beforeEach(() => {
  useUIStore.setState(initialState, true);
});

describe('useUIStore setActiveTable', () => {
  it('is a no-op for pointer/voice state when the table id does not change', () => {
    useUIStore.getState().setActiveTable('table-1');
    useUIStore.getState().setActiveCell({ rowKey: 'row-1', tableColumnId: 'col-1' });
    useUIStore.getState().setContinuousMode(true);

    useUIStore.getState().setActiveTable('table-1');

    const state = useUIStore.getState();
    expect(state.activeTableId).toBe('table-1');
    expect(state.activeCell).toEqual({ rowKey: 'row-1', tableColumnId: 'col-1' });
    expect(state.continuousMode).toBe(true);
  });

  it('clears the pointer and voice/confirmation state when the table id changes', () => {
    useUIStore.getState().setActiveTable('table-1');
    useUIStore.getState().setActiveCell({ rowKey: 'row-1', tableColumnId: 'col-1' });
    useUIStore.getState().setContinuousMode(true);
    useUIStore.getState().setPendingConfirmation({ entity: 'Alice', value: '5', confidence: 0.9 });
    useUIStore.getState().setPendingBatchConfirmation([], 0);
    useUIStore.getState().setLastTranscript('five');
    useUIStore.getState().setProvisionalFeedback({ interimTranscript: 'fi' });

    useUIStore.getState().setActiveTable('table-2');

    const state = useUIStore.getState();
    expect(state.activeTableId).toBe('table-2');
    expect(state.activeCell).toBeNull();
    expect(state.continuousMode).toBe(false);
    expect(state.recordingState).toBe('idle');
    expect(state.pendingConfirmation).toBeNull();
    expect(state.pendingBatchConfirmation).toBeNull();
    expect(state.lastTranscript).toBeNull();
    expect(state.provisionalFeedback).toEqual({
      interimTranscript: null,
      provisionalRowKey: null,
      provisionalValue: null,
    });
  });

  it('also clears state when switching from a table to null', () => {
    useUIStore.getState().setActiveTable('table-1');
    useUIStore.getState().setActiveCell({ rowKey: 'row-1', tableColumnId: 'col-1' });

    useUIStore.getState().setActiveTable(null);

    const state = useUIStore.getState();
    expect(state.activeTableId).toBeNull();
    expect(state.activeCell).toBeNull();
  });

  it('clears an active selection when the table id changes', () => {
    useUIStore.getState().setGridOrder(['row-1', 'row-2'], ['col-1', 'col-2']);
    useUIStore.getState().setSelectionRange({
      anchor: { rowKey: 'row-1', tableColumnId: 'col-1' },
      focus: { rowKey: 'row-2', tableColumnId: 'col-2' },
    });

    useUIStore.getState().setActiveTable('table-2');

    const state = useUIStore.getState();
    expect(state.selectionRange).toBeNull();
    expect(state.selectedKeys.size).toBe(0);
  });
});

describe('useUIStore selection (docs/features/20_interactive_grid_selection.md §5)', () => {
  beforeEach(() => {
    useUIStore.getState().setGridOrder(['row-1', 'row-2', 'row-3'], ['col-1', 'col-2', 'col-3']);
  });

  it('resolves a rectangle spanning anchor to focus, inclusive', () => {
    useUIStore.getState().setSelectionRange({
      anchor: { rowKey: 'row-1', tableColumnId: 'col-1' },
      focus: { rowKey: 'row-2', tableColumnId: 'col-2' },
    });

    const { selectedKeys } = useUIStore.getState();
    expect(selectedKeys).toEqual(
      new Set(['row-1:col-1', 'row-1:col-2', 'row-2:col-1', 'row-2:col-2'])
    );
  });

  it('resolves the same rectangle when anchor/focus are reversed (drag toward the origin)', () => {
    useUIStore.getState().setSelectionRange({
      anchor: { rowKey: 'row-2', tableColumnId: 'col-2' },
      focus: { rowKey: 'row-1', tableColumnId: 'col-1' },
    });

    const { selectedKeys } = useUIStore.getState();
    expect(selectedKeys).toEqual(
      new Set(['row-1:col-1', 'row-1:col-2', 'row-2:col-1', 'row-2:col-2'])
    );
  });

  it('leaves selectedKeys empty for a 1-cell range — no redundant single-cell selection', () => {
    useUIStore.getState().setSelectionRange({
      anchor: { rowKey: 'row-1', tableColumnId: 'col-1' },
      focus: { rowKey: 'row-1', tableColumnId: 'col-1' },
    });

    expect(useUIStore.getState().selectedKeys.size).toBe(0);
  });

  it('extendSelection grows the range from the existing anchor, not from focus', () => {
    useUIStore.getState().setSelectionRange({
      anchor: { rowKey: 'row-1', tableColumnId: 'col-1' },
      focus: { rowKey: 'row-1', tableColumnId: 'col-1' },
    });

    useUIStore.getState().extendSelection({ rowKey: 'row-3', tableColumnId: 'col-3' });

    const state = useUIStore.getState();
    expect(state.selectionRange?.anchor).toEqual({ rowKey: 'row-1', tableColumnId: 'col-1' });
    expect(state.selectedKeys.size).toBe(9);
  });

  it('extendSelection anchors to activeCell when no selection exists yet', () => {
    useUIStore.getState().setActiveCell({ rowKey: 'row-1', tableColumnId: 'col-1' });

    useUIStore.getState().extendSelection({ rowKey: 'row-2', tableColumnId: 'col-2' });

    const state = useUIStore.getState();
    expect(state.selectionRange).toEqual({
      anchor: { rowKey: 'row-1', tableColumnId: 'col-1' },
      focus: { rowKey: 'row-2', tableColumnId: 'col-2' },
    });
  });

  it('setActiveCell clears any existing selection', () => {
    useUIStore.getState().setSelectionRange({
      anchor: { rowKey: 'row-1', tableColumnId: 'col-1' },
      focus: { rowKey: 'row-2', tableColumnId: 'col-2' },
    });

    useUIStore.getState().setActiveCell({ rowKey: 'row-3', tableColumnId: 'col-3' });

    const state = useUIStore.getState();
    expect(state.selectionRange).toBeNull();
    expect(state.selectedKeys.size).toBe(0);
  });

  it('clearSelection resets both selectionRange and selectedKeys', () => {
    useUIStore.getState().setSelectionRange({
      anchor: { rowKey: 'row-1', tableColumnId: 'col-1' },
      focus: { rowKey: 'row-2', tableColumnId: 'col-2' },
    });

    useUIStore.getState().clearSelection();

    const state = useUIStore.getState();
    expect(state.selectionRange).toBeNull();
    expect(state.selectedKeys.size).toBe(0);
  });

  it('resolveSelectionCells returns the rectangle as CellPosition pairs, usable directly as write targets', () => {
    const cells = resolveSelectionCells(
      {
        anchor: { rowKey: 'row-1', tableColumnId: 'col-1' },
        focus: { rowKey: 'row-2', tableColumnId: 'col-2' },
      },
      { rowIds: ['row-1', 'row-2', 'row-3'], columnIds: ['col-1', 'col-2', 'col-3'] }
    );
    expect(cells).toEqual(
      expect.arrayContaining([
        { rowKey: 'row-1', tableColumnId: 'col-1' },
        { rowKey: 'row-1', tableColumnId: 'col-2' },
        { rowKey: 'row-2', tableColumnId: 'col-1' },
        { rowKey: 'row-2', tableColumnId: 'col-2' },
      ])
    );
    expect(cells).toHaveLength(4);
  });

  it('resetUI clears the selection', () => {
    useUIStore.getState().setSelectionRange({
      anchor: { rowKey: 'row-1', tableColumnId: 'col-1' },
      focus: { rowKey: 'row-2', tableColumnId: 'col-2' },
    });

    useUIStore.getState().resetUI();

    const state = useUIStore.getState();
    expect(state.selectionRange).toBeNull();
    expect(state.selectedKeys.size).toBe(0);
  });
});
