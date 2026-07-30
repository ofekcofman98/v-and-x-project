import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
const getAccessibleOrganizationIdsMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  getAccessibleOrganizationIds: (...args: unknown[]) => getAccessibleOrganizationIdsMock(...args),
}));

const createGroupMock = vi.fn();
vi.mock('@/lib/server/services/group-service', () => ({
  createGroup: (...args: unknown[]) => createGroupMock(...args),
}));

import { POST } from './route';

const WORKBENCH_ID = '3ab0c2e0-1234-4abc-89ab-1234567890ab';

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/groups', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  getAccessibleOrganizationIdsMock.mockReset();
  createGroupMock.mockReset();
  getAccessibleOrganizationIdsMock.mockResolvedValue([]);
});

describe('POST /api/groups', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await POST(req({ workbenchId: WORKBENCH_ID, name: 'Grade 1' }), {} as never);

    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(req({ workbenchId: 'not-a-uuid', name: 'Grade 1' }), {} as never);

    expect(res.status).toBe(400);
    expect(createGroupMock).not.toHaveBeenCalled();
  });

  it('creates a group scoped to the workbench and user', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    createGroupMock.mockResolvedValue({ id: 'grp-1', workbenchId: WORKBENCH_ID, name: 'Grade 1' });

    const res = await POST(req({ workbenchId: WORKBENCH_ID, name: 'Grade 1' }), {} as never);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({
      success: true,
      data: { id: 'grp-1', workbenchId: WORKBENCH_ID, name: 'Grade 1' },
    });
    expect(createGroupMock).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationIds: [],
      workbenchId: WORKBENCH_ID,
      name: 'Grade 1',
    });
  });

  it('maps a "not found" service error (bad parentGroupId) to 404', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    createGroupMock.mockRejectedValue(new Error('Parent group not found'));

    const res = await POST(req({ workbenchId: WORKBENCH_ID, name: 'Class 1A', parentGroupId: WORKBENCH_ID }), {} as never);

    expect(res.status).toBe(404);
  });

  it('maps a depth-cap error to 400', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    createGroupMock.mockRejectedValue(new Error('Group nesting exceeds the maximum depth of 5'));

    const res = await POST(req({ workbenchId: WORKBENCH_ID, name: 'Too deep', parentGroupId: WORKBENCH_ID }), {} as never);

    expect(res.status).toBe(400);
  });
});
