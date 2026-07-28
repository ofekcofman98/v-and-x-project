import { describe, it, expect, beforeEach } from 'vitest';
import { useGridChatStore } from './grid-chat-store';

const initialState = useGridChatStore.getState();

beforeEach(() => {
  useGridChatStore.setState(initialState, true);
});

describe('useGridChatStore', () => {
  it('opens for a table and resets messages/pendingAction when switching tables', () => {
    useGridChatStore.getState().appendMessage({ role: 'user', content: 'hi' });
    useGridChatStore.getState().setPendingAction({
      actionId: 'act-1',
      kind: 'updateCellsBatch',
      summary: 's',
      updates: [],
    });

    useGridChatStore.getState().open('table-2');

    const state = useGridChatStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.tableId).toBe('table-2');
    expect(state.messages).toEqual([]);
    expect(state.pendingAction).toBeNull();
    expect(state.isConfirmDialogOpen).toBe(false);
  });

  it('preserves messages/pendingAction when re-opening the same table', () => {
    useGridChatStore.getState().open('table-1');
    useGridChatStore.getState().appendMessage({ role: 'user', content: 'hi' });

    useGridChatStore.getState().close();
    useGridChatStore.getState().open('table-1');

    const state = useGridChatStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('trims history to the last 20 messages', () => {
    for (let i = 0; i < 25; i++) {
      useGridChatStore.getState().appendMessage({ role: 'user', content: `msg-${i}` });
    }

    const { messages } = useGridChatStore.getState();
    expect(messages).toHaveLength(20);
    expect(messages[0].content).toBe('msg-5');
    expect(messages[19].content).toBe('msg-24');
  });

  it('setPendingAction opens the confirm dialog, clearPendingAction closes it', () => {
    useGridChatStore.getState().setPendingAction({
      actionId: 'act-1',
      kind: 'updateCellsBatch',
      summary: 's',
      updates: [],
    });
    expect(useGridChatStore.getState().isConfirmDialogOpen).toBe(true);
    expect(useGridChatStore.getState().pendingAction?.actionId).toBe('act-1');

    useGridChatStore.getState().clearPendingAction();
    expect(useGridChatStore.getState().isConfirmDialogOpen).toBe(false);
    expect(useGridChatStore.getState().pendingAction).toBeNull();
  });
});
