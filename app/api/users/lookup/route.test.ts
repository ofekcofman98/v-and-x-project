import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
}));

const findUserByEmailMock = vi.fn();
vi.mock('@/lib/server/services/user-lookup', () => ({
  findUserByEmail: (...args: unknown[]) => findUserByEmailMock(...args),
}));

import { GET } from './route';

function req(email: string): NextRequest {
  return new NextRequest(`http://localhost/api/users/lookup?email=${encodeURIComponent(email)}`, { method: 'GET' });
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  findUserByEmailMock.mockReset();
});

describe('GET /api/users/lookup', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await GET(req('a@b.com'), {} as never);

    expect(res.status).toBe(401);
  });

  it('returns 400 on an invalid email', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await GET(req('not-an-email'), {} as never);

    expect(res.status).toBe(400);
    expect(findUserByEmailMock).not.toHaveBeenCalled();
  });

  it('returns 404 when no user is found', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    findUserByEmailMock.mockResolvedValue(null);

    const res = await GET(req('nobody@example.com'), {} as never);

    expect(res.status).toBe(404);
  });

  it('returns the resolved user on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    findUserByEmailMock.mockResolvedValue({ id: 'target-user', email: 'a@b.com' });

    const res = await GET(req('a@b.com'), {} as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { id: 'target-user', email: 'a@b.com' } });
  });
});
