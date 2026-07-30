import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
const getAccessibleOrganizationIdsMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  getAccessibleOrganizationIds: (...args: unknown[]) => getAccessibleOrganizationIdsMock(...args),
}));

const getWorkbenchByIdMock = vi.fn();
const updateWorkbenchMock = vi.fn();
const deleteWorkbenchMock = vi.fn();
vi.mock('@/lib/server/services/workbench-service', () => ({
  getWorkbenchById: (...args: unknown[]) => getWorkbenchByIdMock(...args),
  updateWorkbench: (...args: unknown[]) => updateWorkbenchMock(...args),
  deleteWorkbench: (...args: unknown[]) => deleteWorkbenchMock(...args),
}));

import { GET, PATCH, DELETE } from './route';

const VALID_ID = '3ab0c2e0-1234-4abc-89ab-1234567890ab';

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/workbenches/${VALID_ID}`, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  getAccessibleOrganizationIdsMock.mockReset();
  getWorkbenchByIdMock.mockReset();
  updateWorkbenchMock.mockReset();
  deleteWorkbenchMock.mockReset();
  getAccessibleOrganizationIdsMock.mockResolvedValue([]);
});

describe('GET /api/workbenches/:id', () => {
  it('returns 400 on an invalid id', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await GET(req('GET'), ctx('not-a-uuid'));

    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await GET(req('GET'), ctx(VALID_ID));

    expect(res.status).toBe(401);
  });

  it('maps a "not found" service error to 404', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    getWorkbenchByIdMock.mockRejectedValue(new Error('Workbench not found'));

    const res = await GET(req('GET'), ctx(VALID_ID));

    expect(res.status).toBe(404);
  });

  it('returns the workbench on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    getWorkbenchByIdMock.mockResolvedValue({ id: VALID_ID, name: 'Classes' });

    const res = await GET(req('GET'), ctx(VALID_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { id: VALID_ID, name: 'Classes' } });
  });
});

describe('PATCH /api/workbenches/:id', () => {
  it('returns 400 on invalid body', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await PATCH(req('PATCH', { name: '' }), ctx(VALID_ID));

    expect(res.status).toBe(400);
    expect(updateWorkbenchMock).not.toHaveBeenCalled();
  });

  it('updates the workbench on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    updateWorkbenchMock.mockResolvedValue({ id: VALID_ID, name: 'Renamed' });

    const res = await PATCH(req('PATCH', { name: 'Renamed' }), ctx(VALID_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { id: VALID_ID, name: 'Renamed' } });
  });
});

describe('DELETE /api/workbenches/:id', () => {
  it('deletes the workbench on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    deleteWorkbenchMock.mockResolvedValue({ id: VALID_ID });

    const res = await DELETE(req('DELETE'), ctx(VALID_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { id: VALID_ID } });
  });

  it('maps a "not found" service error to 404', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    deleteWorkbenchMock.mockRejectedValue(new Error('Workbench not found'));

    const res = await DELETE(req('DELETE'), ctx(VALID_ID));

    expect(res.status).toBe(404);
  });
});
