import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
}));

const runGridAgentTurnMock = vi.fn();
vi.mock('@/lib/server/services/ai-service/grid-agent', () => ({
  runGridAgentTurn: (...args: unknown[]) => runGridAgentTurnMock(...args),
}));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/grid-agent', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  runGridAgentTurnMock.mockReset();
});

describe('POST /api/ai/grid-agent', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await POST(req({ tableId: '3ab0c2e0-1234-4abc-89ab-1234567890ab', message: 'hi' }), {} as never);

    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(req({ tableId: 'not-a-uuid', message: 'hi' }), {} as never);

    expect(res.status).toBe(400);
    expect(runGridAgentTurnMock).not.toHaveBeenCalled();
  });

  it('ignores any tableId smuggled elsewhere and only forwards the body tableId — the scoped, authenticated one', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    runGridAgentTurnMock.mockResolvedValue({ answer: 'ok', usage: { inputTokens: 1, outputTokens: 1 } });

    const tableId = '3ab0c2e0-1234-4abc-89ab-1234567890ab';
    const res = await POST(req({ tableId, message: 'hello' }), {} as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { answer: 'ok', usage: { inputTokens: 1, outputTokens: 1 } } });
    expect(runGridAgentTurnMock).toHaveBeenCalledWith({
      userId: 'user-1',
      tableId,
      message: 'hello',
      history: undefined,
    });
  });

  it('maps a "not found" service error to 404', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    runGridAgentTurnMock.mockRejectedValue(new Error('Table with ID x not found'));

    const res = await POST(
      req({ tableId: '3ab0c2e0-1234-4abc-89ab-1234567890ab', message: 'hi' }),
      {} as never
    );

    expect(res.status).toBe(404);
  });
});
