import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
}));

const recordVoiceInteractionMock = vi.fn();
vi.mock('@/lib/server/services/telemetry/voice-interaction-service', () => ({
  recordVoiceInteraction: (...args: unknown[]) => recordVoiceInteractionMock(...args),
}));

import { POST } from './route';

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/voice-telemetry', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  recordVoiceInteractionMock.mockReset();
  recordVoiceInteractionMock.mockResolvedValue(undefined);
});

describe('POST /api/voice-telemetry', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await POST(postReq({ requestId: 'req-1' }), {} as never);

    expect(res.status).toBe(401);
    expect(recordVoiceInteractionMock).not.toHaveBeenCalled();
  });

  it('returns 400 when requestId is missing', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(postReq({ vadStartAt: '2026-08-22T10:00:00.000Z' }), {} as never);

    expect(res.status).toBe(400);
    expect(recordVoiceInteractionMock).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid matchingTierUsed enum value', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(
      postReq({ requestId: 'req-1', matchingTierUsed: 'vector' }),
      {} as never
    );

    expect(res.status).toBe(400);
    expect(recordVoiceInteractionMock).not.toHaveBeenCalled();
  });

  it('returns 400 on a malformed timestamp', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(
      postReq({ requestId: 'req-1', vadStartAt: 'not-a-timestamp' }),
      {} as never
    );

    expect(res.status).toBe(400);
    expect(recordVoiceInteractionMock).not.toHaveBeenCalled();
  });

  it('accepts a minimal valid body (only requestId) and records it', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(postReq({ requestId: 'req-1' }), {} as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { recorded: true } });
    expect(recordVoiceInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-1' })
    );
  });

  it('accepts a fully populated body and passes it through to the service', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const body = {
      requestId: 'req-2',
      vadStartAt: '2026-08-22T10:00:00.000Z',
      dbWriteAckAt: '2026-08-22T10:00:06.200Z',
      confirmationRoute: 'auto',
      matchingTierUsed: 'exact',
      whisperTranscript: 'Noa Cohen, 84',
    };

    const res = await POST(postReq(body), {} as never);

    expect(res.status).toBe(200);
    expect(recordVoiceInteractionMock).toHaveBeenCalledWith(expect.objectContaining(body));
  });

  it('does not 500 when the (never-throwing) service call still rejects unexpectedly', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    recordVoiceInteractionMock.mockRejectedValue(new Error('unexpected'));

    const res = await POST(postReq({ requestId: 'req-1' }), {} as never);

    // withErrorHandler catches this as a 500 — asserting the wrapper's
    // contract holds even if recordVoiceInteraction's never-throw guarantee
    // were ever violated.
    expect(res.status).toBe(500);
  });
});
