import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getAuthenticatedUserMock = vi.fn();
const getAccessibleOrganizationIdsMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  getAccessibleOrganizationIds: (...args: unknown[]) => getAccessibleOrganizationIdsMock(...args),
}));

const applyTemplateToGroupMock = vi.fn();
vi.mock('@/lib/server/services/group-service', () => ({
  applyTemplateToGroup: (...args: unknown[]) => applyTemplateToGroupMock(...args),
}));

import { POST } from './route';

const GROUP_ID = '3ab0c2e0-1234-4abc-89ab-1234567890ab';
const TEMPLATE_ID = 'b1c2d3e4-1234-4abc-89ab-1234567890ab';

function req(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/groups/${GROUP_ID}/apply-template`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  getAccessibleOrganizationIdsMock.mockReset();
  applyTemplateToGroupMock.mockReset();
  getAccessibleOrganizationIdsMock.mockResolvedValue([]);
});

describe('POST /api/groups/:id/apply-template', () => {
  it('returns 400 on an invalid group id', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(req({ templateId: TEMPLATE_ID }), ctx('not-a-uuid'));

    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const res = await POST(req({ templateId: TEMPLATE_ID }), ctx(GROUP_ID));

    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });

    const res = await POST(req({ templateId: 'not-a-uuid' }), ctx(GROUP_ID));

    expect(res.status).toBe(400);
    expect(applyTemplateToGroupMock).not.toHaveBeenCalled();
  });

  it('maps a "not found" service error to 404', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    applyTemplateToGroupMock.mockRejectedValue(new Error('Group not found'));

    const res = await POST(req({ templateId: TEMPLATE_ID }), ctx(GROUP_ID));

    expect(res.status).toBe(404);
  });

  it('maps the max-lists cap error to 400', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    applyTemplateToGroupMock.mockRejectedValue(
      new Error('Group contains 51 lists, exceeding the max of 50 for one bulk apply')
    );

    const res = await POST(req({ templateId: TEMPLATE_ID }), ctx(GROUP_ID));

    expect(res.status).toBe(400);
  });

  it('returns partial-success results without failing the whole request', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    const serviceResult = {
      results: [
        {
          baseListId: 'a1',
          baseListName: 'Class_1A',
          groupPath: 'Grade 1 / Class 1A',
          status: 'created',
          tableId: 't1',
        },
        {
          baseListId: 'a2',
          baseListName: 'Class_1B',
          groupPath: 'Grade 1 / Class 1B',
          status: 'failed',
          error: 'BaseList not found',
        },
      ],
      createdCount: 1,
      failedCount: 1,
    };
    applyTemplateToGroupMock.mockResolvedValue(serviceResult);

    const res = await POST(
      req({ templateId: TEMPLATE_ID, autoSync: true, selectedBaseListColumnIds: ['name'] }),
      ctx(GROUP_ID)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: serviceResult });
    expect(applyTemplateToGroupMock).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationIds: [],
      groupId: GROUP_ID,
      templateId: TEMPLATE_ID,
      autoSync: true,
      selectedBaseListColumnIds: ['name'],
    });
  });
});
