import { describe, it, expect, beforeEach } from 'vitest';
import { useGlobalChatStore } from './global-chat-store';

const initialState = useGlobalChatStore.getState();
const MENTION_A = { type: 'baseList' as const, id: 'bl-1' };
const MENTION_B = { type: 'baseList' as const, id: 'bl-2' };

beforeEach(() => {
  useGlobalChatStore.setState(initialState, true);
});

describe('useGlobalChatStore', () => {
  it('opens without requiring a mention', () => {
    useGlobalChatStore.getState().open();
    expect(useGlobalChatStore.getState().isOpen).toBe(true);
  });

  it('resets messages/pendingAction when the active mention changes', () => {
    useGlobalChatStore.getState().setActiveMention(MENTION_A);
    useGlobalChatStore.getState().appendMessage({ role: 'user', content: 'hi' });
    useGlobalChatStore.getState().setPendingAction({
      actionId: 'act-1',
      kind: 'updateCellsBatch',
      summary: 's',
      updates: [],
    });

    useGlobalChatStore.getState().setActiveMention(MENTION_B);

    const state = useGlobalChatStore.getState();
    expect(state.activeMention).toEqual(MENTION_B);
    expect(state.messages).toEqual([]);
    expect(state.pendingAction).toBeNull();
    expect(state.isConfirmDialogOpen).toBe(false);
  });

  it('preserves messages/pendingAction when re-setting the same mention', () => {
    useGlobalChatStore.getState().setActiveMention(MENTION_A);
    useGlobalChatStore.getState().appendMessage({ role: 'user', content: 'hi' });

    useGlobalChatStore.getState().setActiveMention(MENTION_A);

    const state = useGlobalChatStore.getState();
    expect(state.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('trims history to the last 20 messages', () => {
    for (let i = 0; i < 25; i++) {
      useGlobalChatStore.getState().appendMessage({ role: 'user', content: `msg-${i}` });
    }

    const { messages } = useGlobalChatStore.getState();
    expect(messages).toHaveLength(20);
    expect(messages[0].content).toBe('msg-5');
    expect(messages[19].content).toBe('msg-24');
  });

  it('setPendingAction opens the confirm dialog, clearPendingAction closes it', () => {
    useGlobalChatStore.getState().setPendingAction({
      actionId: 'act-1',
      kind: 'updateCellsBatch',
      summary: 's',
      updates: [],
    });
    expect(useGlobalChatStore.getState().isConfirmDialogOpen).toBe(true);
    expect(useGlobalChatStore.getState().pendingAction?.actionId).toBe('act-1');

    useGlobalChatStore.getState().clearPendingAction();
    expect(useGlobalChatStore.getState().isConfirmDialogOpen).toBe(false);
    expect(useGlobalChatStore.getState().pendingAction).toBeNull();
  });
});
