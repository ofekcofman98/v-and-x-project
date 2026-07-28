import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
const getAccessibleOrganizationIdsMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  getAccessibleOrganizationIds: (...args: unknown[]) => getAccessibleOrganizationIdsMock(...args),
}));

const runGlobalAgentTurnMock = vi.fn();
vi.mock('@/lib/server/services/ai-service/global-agent', () => ({
  runGlobalAgentTurn: (...args: unknown[]) => runGlobalAgentTurnMock(...args),
}));

import { POST } from './route';

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/global-agent', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const MENTION = { type: 'baseList', id: '3ab0c2e0-1234-4abc-89ab-1234567890ab' };

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  getAccessibleOrganizationIdsMock.mockReset().mockResolvedValue([]);
  runGlobalAgentTurnMock.mockReset();
});

describe('POST /api/ai/global-agent', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await POST(req({ message: 'hi', mentions: [MENTION] }), {} as never);

    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body (no mentions)', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(req({ message: 'hi', mentions: [] }), {} as never);

    expect(res.status).toBe(400);
    expect(runGlobalAgentTurnMock).not.toHaveBeenCalled();
  });

  it('forwards the first mention, message, and history to runGlobalAgentTurn', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    getAccessibleOrganizationIdsMock.mockResolvedValue(['org-1']);
    runGlobalAgentTurnMock.mockResolvedValue({ answer: 'ok', usage: { inputTokens: 1, outputTokens: 1 } });

    const res = await POST(req({ message: 'hello', mentions: [MENTION] }), {} as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { answer: 'ok', usage: { inputTokens: 1, outputTokens: 1 } } });
    expect(runGlobalAgentTurnMock).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationIds: ['org-1'],
      mention: MENTION,
      message: 'hello',
      history: undefined,
    });
  });

  it('maps a "not found" service error to 404', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    runGlobalAgentTurnMock.mockRejectedValue(new Error('BaseList not found'));

    const res = await POST(req({ message: 'hi', mentions: [MENTION] }), {} as never);

    expect(res.status).toBe(404);
  });
});
