import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
const getAccessibleOrganizationIdsMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  getAccessibleOrganizationIds: (...args: unknown[]) => getAccessibleOrganizationIdsMock(...args),
}));

const getGroupTreeMock = vi.fn();
vi.mock('@/lib/server/services/group-service', () => ({
  getGroupTree: (...args: unknown[]) => getGroupTreeMock(...args),
}));

import { GET } from './route';

const VALID_ID = '3ab0c2e0-1234-4abc-89ab-1234567890ab';

function req(): NextRequest {
  return new NextRequest(`http://localhost/api/groups/${VALID_ID}/tree`, { method: 'GET' });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  getAccessibleOrganizationIdsMock.mockReset();
  getGroupTreeMock.mockReset();
  getAccessibleOrganizationIdsMock.mockResolvedValue([]);
});

describe('GET /api/groups/:id/tree', () => {
  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await GET(req(), ctx(VALID_ID));

    expect(res.status).toBe(401);
  });

  it('maps a "not found" service error to 404', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    getGroupTreeMock.mockRejectedValue(new Error('Group not found'));

    const res = await GET(req(), ctx(VALID_ID));

    expect(res.status).toBe(404);
  });

  it('returns the recursive tree on success', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    const tree = {
      id: VALID_ID,
      name: 'Grade 1',
      description: null,
      childGroups: [{ id: 'child-1', name: 'Class 1A', description: null, childGroups: [], baseLists: [] }],
      baseLists: [],
    };
    getGroupTreeMock.mockResolvedValue(tree);

    const res = await GET(req(), ctx(VALID_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: tree });
  });
});
