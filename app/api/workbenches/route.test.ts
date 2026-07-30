import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
const getAccessibleOrganizationIdsMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  getAccessibleOrganizationIds: (...args: unknown[]) => getAccessibleOrganizationIdsMock(...args),
}));

const createWorkbenchMock = vi.fn();
const listWorkbenchesMock = vi.fn();
vi.mock('@/lib/server/services/workbench-service', () => ({
  createWorkbench: (...args: unknown[]) => createWorkbenchMock(...args),
  listWorkbenches: (...args: unknown[]) => listWorkbenchesMock(...args),
}));

import { POST, GET } from './route';

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/workbenches', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  getAccessibleOrganizationIdsMock.mockReset();
  createWorkbenchMock.mockReset();
  listWorkbenchesMock.mockReset();
});

describe('POST /api/workbenches', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await POST(postReq({ name: 'Classes' }), {} as never);

    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(postReq({}), {} as never);

    expect(res.status).toBe(400);
    expect(createWorkbenchMock).not.toHaveBeenCalled();
  });

  it('creates a workbench for the authenticated user', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    createWorkbenchMock.mockResolvedValue({ id: 'wb-1', name: 'Classes' });

    const res = await POST(postReq({ name: 'Classes' }), {} as never);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ success: true, data: { id: 'wb-1', name: 'Classes' } });
    expect(createWorkbenchMock).toHaveBeenCalledWith({ userId: 'user-1', name: 'Classes' });
  });
});

describe('GET /api/workbenches', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await GET({} as never, {} as never);

    expect(res.status).toBe(401);
  });

  it('lists workbenches scoped to the user and their orgs', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    getAccessibleOrganizationIdsMock.mockResolvedValue(['org-1']);
    listWorkbenchesMock.mockResolvedValue([{ id: 'wb-1', name: 'Classes' }]);

    const res = await GET({} as never, {} as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: [{ id: 'wb-1', name: 'Classes' }] });
    expect(listWorkbenchesMock).toHaveBeenCalledWith('user-1', ['org-1']);
  });
});
