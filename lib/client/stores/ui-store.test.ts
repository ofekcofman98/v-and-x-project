import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './ui-store';

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
});
