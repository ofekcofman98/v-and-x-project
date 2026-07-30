import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
const getAccessibleOrganizationIdsMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  getAccessibleOrganizationIds: (...args: unknown[]) => getAccessibleOrganizationIdsMock(...args),
}));

const getGroupByIdMock = vi.fn();
const updateGroupMock = vi.fn();
const deleteGroupMock = vi.fn();
vi.mock('@/lib/server/services/group-service', () => ({
  getGroupById: (...args: unknown[]) => getGroupByIdMock(...args),
  updateGroup: (...args: unknown[]) => updateGroupMock(...args),
  deleteGroup: (...args: unknown[]) => deleteGroupMock(...args),
}));

import { GET, PATCH, DELETE } from './route';

const VALID_ID = '3ab0c2e0-1234-4abc-89ab-1234567890ab';

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/groups/${VALID_ID}`, {
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
  getGroupByIdMock.mockReset();
  updateGroupMock.mockReset();
  deleteGroupMock.mockReset();
  getAccessibleOrganizationIdsMock.mockResolvedValue([]);
});

describe('GET /api/groups/:id', () => {
  it('returns 400 on an invalid id', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await GET(req('GET'), ctx('not-a-uuid'));

    expect(res.status).toBe(400);
  });

  it('maps a "not found" service error (no access) to 404', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    getGroupByIdMock.mockRejectedValue(new Error('Group not found'));

    const res = await GET(req('GET'), ctx(VALID_ID));

    expect(res.status).toBe(404);
  });

  it('returns the group on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    getGroupByIdMock.mockResolvedValue({ id: VALID_ID, name: 'Grade 1' });

    const res = await GET(req('GET'), ctx(VALID_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { id: VALID_ID, name: 'Grade 1' } });
  });
});

describe('PATCH /api/groups/:id', () => {
  it('maps a different-workbench re-parent error to 400', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    updateGroupMock.mockRejectedValue(new Error('Cannot re-parent a group into a different workbench'));

    const res = await PATCH(req('PATCH', { parentGroupId: VALID_ID }), ctx(VALID_ID));

    expect(res.status).toBe(400);
  });

  it('updates the group on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    updateGroupMock.mockResolvedValue({ id: VALID_ID, name: 'Renamed' });

    const res = await PATCH(req('PATCH', { name: 'Renamed' }), ctx(VALID_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { id: VALID_ID, name: 'Renamed' } });
  });
});

describe('DELETE /api/groups/:id', () => {
  it('deletes the group on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    deleteGroupMock.mockResolvedValue({ id: VALID_ID });

    const res = await DELETE(req('DELETE'), ctx(VALID_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { id: VALID_ID } });
  });
});
