import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { GlobalAgentError, runGlobalAgentTurn, executeGlobalAgentAction } from './use-global-agent';

const MENTION = { type: 'baseList' as const, id: 'bl-1' };

beforeEach(() => {
  fetchMock.mockReset();
});

describe('runGlobalAgentTurn', () => {
  it('returns result.data on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { answer: 'ok' } }),
    });

    const data = await runGlobalAgentTurn({ message: 'hi', mentions: [MENTION] });

    expect(data).toEqual({ answer: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/global-agent',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws GlobalAgentError with joined messages on a non-2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: ['Invalid mention'] }),
    });

    await expect(runGlobalAgentTurn({ message: 'hi', mentions: [MENTION] })).rejects.toThrow(GlobalAgentError);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: ['Invalid mention'] }),
    });
    await expect(runGlobalAgentTurn({ message: 'hi', mentions: [MENTION] })).rejects.toThrow('Invalid mention');
  });

  it('falls back to a generic message when the body is unparsable', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(runGlobalAgentTurn({ message: 'hi', mentions: [MENTION] })).rejects.toThrow(
      'Global Agent request failed'
    );
  });
});

describe('executeGlobalAgentAction', () => {
  it('posts to the execute endpoint and returns result.data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { updated: 1, failed: [] } }),
    });

    const data = await executeGlobalAgentAction({ actionId: 'act-1' });

    expect(data).toEqual({ updated: 1, failed: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/global-agent/execute',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ actionId: 'act-1' }) })
    );
  });
});
