import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { GridAgentError, runGridAgentTurn, executeGridAgentAction } from './use-grid-agent';

beforeEach(() => {
  fetchMock.mockReset();
});

describe('runGridAgentTurn', () => {
  it('returns result.data on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { answer: 'ok' } }),
    });

    const data = await runGridAgentTurn({ tableId: 't', message: 'hi' });

    expect(data).toEqual({ answer: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/grid-agent',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws GridAgentError with joined messages on a non-2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: ['Invalid tableId'] }),
    });

    await expect(runGridAgentTurn({ tableId: 't', message: 'hi' })).rejects.toThrow(GridAgentError);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: ['Invalid tableId'] }),
    });
    await expect(runGridAgentTurn({ tableId: 't', message: 'hi' })).rejects.toThrow('Invalid tableId');
  });

  it('falls back to a generic message when the body is unparsable', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(runGridAgentTurn({ tableId: 't', message: 'hi' })).rejects.toThrow('Grid Agent request failed');
  });
});

describe('executeGridAgentAction', () => {
  it('posts to the execute endpoint and returns result.data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { updated: 1, failed: [] } }),
    });

    const data = await executeGridAgentAction({ actionId: 'act-1' });

    expect(data).toEqual({ updated: 1, failed: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/grid-agent/execute',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ actionId: 'act-1' }) })
    );
  });
});
