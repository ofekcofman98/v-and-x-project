import { describe, expect, it } from 'vitest';
import { OrgRole } from '@/lib/shared/generated/prisma/client';
import { canAccessColumn, filterAccessibleColumns } from './column-access';

const OWNER_ID = 'owner-1';
const ADMIN_ID = 'admin-1';
const OTHER_ID = 'other-1';

describe('canAccessColumn', () => {
  it('always grants access to the table owner, regardless of access rules', () => {
    const column = { access: { visibility: 'private', allowedRoles: [OrgRole.ADMIN] } };
    expect(canAccessColumn(column, OWNER_ID, true, null)).toBe(true);
  });

  it('grants access when the column has no access rule', () => {
    const column = { access: null };
    expect(canAccessColumn(column, OTHER_ID, false, OrgRole.VIEWER)).toBe(true);
  });

  it('grants access when the column is explicitly public', () => {
    const column = { access: { visibility: 'public' } };
    expect(canAccessColumn(column, OTHER_ID, false, OrgRole.VIEWER)).toBe(true);
  });

  it('grants access to a non-owner whose role is in allowedRoles', () => {
    const column = { access: { visibility: 'private', allowedRoles: [OrgRole.ADMIN, OrgRole.EDITOR] } };
    expect(canAccessColumn(column, ADMIN_ID, false, OrgRole.ADMIN)).toBe(true);
  });

  it('grants access to a non-owner whose userId is in allowedUserIds', () => {
    const column = { access: { visibility: 'private', allowedUserIds: [OTHER_ID] } };
    expect(canAccessColumn(column, OTHER_ID, false, OrgRole.VIEWER)).toBe(true);
  });

  it('denies access to a non-owner with no matching role or user id', () => {
    const column = { access: { visibility: 'private', allowedRoles: [OrgRole.ADMIN] } };
    expect(canAccessColumn(column, OTHER_ID, false, OrgRole.VIEWER)).toBe(false);
  });

  it('denies access when the caller has no org role at all', () => {
    const column = { access: { visibility: 'private', allowedRoles: [OrgRole.VIEWER] } };
    expect(canAccessColumn(column, OTHER_ID, false, null)).toBe(false);
  });
});

describe('filterAccessibleColumns', () => {
  it('keeps only columns the caller is authorized to see', () => {
    const columns = [
      { id: 'public-col', access: null },
      { id: 'private-admin-col', access: { visibility: 'private', allowedRoles: [OrgRole.ADMIN] } },
      { id: 'private-viewer-col', access: { visibility: 'private', allowedRoles: [OrgRole.VIEWER] } },
    ];

    const result = filterAccessibleColumns(columns, OTHER_ID, false, OrgRole.VIEWER);

    expect(result.map((c) => c.id)).toEqual(['public-col', 'private-viewer-col']);
  });

  it('returns every column for the table owner', () => {
    const columns = [
      { id: 'public-col', access: null },
      { id: 'private-col', access: { visibility: 'private', allowedRoles: [OrgRole.ADMIN] } },
    ];

    const result = filterAccessibleColumns(columns, OWNER_ID, true, null);

    expect(result).toHaveLength(2);
  });
});
