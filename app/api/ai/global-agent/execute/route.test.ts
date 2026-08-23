import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
}));

const executeUpdateCellsBatchMock = vi.fn();
vi.mock('@/lib/server/services/ai-service/tools/grid-tools', () => ({
  executeUpdateCellsBatch: (...args: unknown[]) => executeUpdateCellsBatchMock(...args),
}));

const cacheGetMock = vi.fn();
const cacheEvictMock = vi.fn();
vi.mock('@/lib/server/cache/global-agent-cache', () => ({
  pendingGlobalActionCache: {
    get: (...args: unknown[]) => cacheGetMock(...args),
    evict: (...args: unknown[]) => cacheEvictMock(...args),
  },
}));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/global-agent/execute', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  executeUpdateCellsBatchMock.mockReset();
  cacheGetMock.mockReset();
  cacheEvictMock.mockReset();
});

describe('POST /api/ai/global-agent/execute', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const res = await POST(req({ actionId: 'act-1' }), {} as never);
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown or expired actionId', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    cacheGetMock.mockReturnValue(null);

    const res = await POST(req({ actionId: 'act-1' }), {} as never);

    expect(res.status).toBe(404);
    expect(executeUpdateCellsBatchMock).not.toHaveBeenCalled();
  });

  it('returns 403 when the action belongs to a different user', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    cacheGetMock.mockReturnValue({
      actionId: 'act-1',
      kind: 'updateCellsBatch',
      summary: 's',
      updates: [{ rowKey: 'row-1', columnKey: 'score', value: 90, tableId: 'table-1' }],
      userId: 'someone-else',
    });

    const res = await POST(req({ actionId: 'act-1' }), {} as never);

    expect(res.status).toBe(403);
    expect(executeUpdateCellsBatchMock).not.toHaveBeenCalled();
  });

  it('executes exactly the cached updates against the tableId carried on them, stripping tableId, and evicts on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    cacheGetMock.mockReturnValue({
      actionId: 'act-1',
      kind: 'updateCellsBatch',
      summary: 's',
      updates: [{ rowKey: 'row-1', columnKey: 'score', value: 90, tableId: 'table-1' }],
      userId: 'user-1',
    });
    executeUpdateCellsBatchMock.mockResolvedValue({ updated: 1, failed: [] });

    const res = await POST(req({ actionId: 'act-1' }), {} as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { updated: 1, failed: [] } });
    expect(executeUpdateCellsBatchMock).toHaveBeenCalledWith('table-1', 'user-1', [
      { rowKey: 'row-1', columnKey: 'score', value: 90 },
    ]);
    expect(cacheEvictMock).toHaveBeenCalledWith('act-1');
  });
});
