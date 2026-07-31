import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthenticatedUserMock = vi.fn();
const getAccessibleOrganizationIdsMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  getAccessibleOrganizationIds: (...args: unknown[]) => getAccessibleOrganizationIdsMock(...args),
}));

const getAssignedBaseListsMock = vi.fn();
vi.mock('@/lib/server/services/group-service', () => ({
  getAssignedBaseLists: (...args: unknown[]) => getAssignedBaseListsMock(...args),
}));

import { GET } from './route';

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  getAccessibleOrganizationIdsMock.mockReset();
  getAssignedBaseListsMock.mockReset();
  getAccessibleOrganizationIdsMock.mockResolvedValue([]);
});

describe('GET /api/groups/assigned-lists', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await GET({} as never, {} as never);

    expect(res.status).toBe(401);
  });

  it('returns the assigned-lists set on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    const data = [
      { baseListId: 'a1', groupId: 'g1', groupName: 'Class 1A', workbenchId: 'w1', workbenchName: 'Classes' },
    ];
    getAssignedBaseListsMock.mockResolvedValue(data);

    const res = await GET({} as never, {} as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data });
    expect(getAssignedBaseListsMock).toHaveBeenCalledWith('user-1', []);
  });
});
