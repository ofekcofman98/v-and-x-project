import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const groupBaseListFindManyMock = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    group: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
    groupBaseList: {
      findMany: (...args: unknown[]) => groupBaseListFindManyMock(...args),
    },
  },
}));

const getAccessibleGroupIdsMock = vi.fn();
vi.mock('@/lib/server/services/auth', () => ({
  getAccessibleGroupIds: (...args: unknown[]) => getAccessibleGroupIdsMock(...args),
  getAccessibleWorkbenchIds: vi.fn(),
  workbenchOwnershipWhere: vi.fn(),
  GROUP_MAX_DEPTH: 5,
}));

vi.mock('@/lib/server/services/base-list-service', () => ({
  applyTemplateToBaseList: vi.fn(),
}));

import { updateGroup, getAssignedBaseLists } from './group-service';

// Group A is being moved; group B is A's direct child (B.parentGroupId === 'A').
// Group C is an unrelated top-level group (C.parentGroupId === null).
function mockFindUnique() {
  findUniqueMock.mockImplementation(async ({ where, select }: { where: { id: string }; select: Record<string, boolean> }) => {
    if (select.id) {
      // "newParent" lookup shape: { id: true, workbenchId: true }
      return { id: where.id, workbenchId: 'wb1' };
    }
    if (select.parentGroupId) {
      // depth/cycle walk shape: { parentGroupId: true }
      if (where.id === 'B') return { parentGroupId: 'A' };
      if (where.id === 'C') return { parentGroupId: null };
      return null;
    }
    if (select.workbenchId) {
      // "current" lookup shape: { workbenchId: true }
      return { workbenchId: 'wb1' };
    }
    return null;
  });
}

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  groupBaseListFindManyMock.mockReset();
  getAccessibleGroupIdsMock.mockReset();
  getAccessibleGroupIdsMock.mockResolvedValue(['A', 'B', 'C']);
  mockFindUnique();
});

describe('updateGroup — re-parent cycle prevention', () => {
  it('rejects moving a group into its own descendant', async () => {
    await expect(updateGroup('user-1', [], 'A', { parentGroupId: 'B' })).rejects.toThrow(
      /itself or one of its own descendants/
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects moving a group into itself directly', async () => {
    await expect(updateGroup('user-1', [], 'A', { parentGroupId: 'A' })).rejects.toThrow(
      /itself or one of its own descendants/
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('allows moving a group to an unrelated valid parent', async () => {
    updateMock.mockResolvedValue({ id: 'A', parentGroupId: 'C' });

    const result = await updateGroup('user-1', [], 'A', { parentGroupId: 'C' });

    expect(result).toEqual({ id: 'A', parentGroupId: 'C' });
    expect(updateMock).toHaveBeenCalled();
  });
});

describe('getAssignedBaseLists', () => {
  it('returns an empty array when the caller has no accessible groups', async () => {
    getAccessibleGroupIdsMock.mockResolvedValue([]);

    const result = await getAssignedBaseLists('user-1', []);

    expect(result).toEqual([]);
    expect(groupBaseListFindManyMock).not.toHaveBeenCalled();
  });

  it('maps GroupBaseList rows into the flat assigned-lists shape', async () => {
    getAccessibleGroupIdsMock.mockResolvedValue(['g1']);
    groupBaseListFindManyMock.mockResolvedValue([
      {
        baseList: { id: 'a1' },
        group: { id: 'g1', name: 'Class 1A', workbench: { id: 'w1', name: 'Classes' } },
      },
    ]);

    const result = await getAssignedBaseLists('user-1', []);

    expect(result).toEqual([
      { baseListId: 'a1', groupId: 'g1', groupName: 'Class 1A', workbenchId: 'w1', workbenchName: 'Classes' },
    ]);
    expect(groupBaseListFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { groupId: { in: ['g1'] } } })
    );
  });
});
