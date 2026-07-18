/**
 * Client-safe mirror of the Prisma `OrgRole` enum. Declared locally (not imported
 * from lib/shared/generated/prisma) so this file can be imported by Client
 * Components without pulling Node-only Prisma client code into the browser bundle.
 */
export type OrgRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export const ORG_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'];

/**
 * Column-level visibility rule, stored as JSON on TableColumn.access.
 * Absent access or visibility "public" means every table member can see the column.
 */
export interface ColumnAccess {
  visibility: 'public' | 'private';
  allowedRoles?: OrgRole[];
  allowedUserIds?: string[];
}

export interface ColumnAccessUpdate {
  visibility: 'public' | 'private';
  allowedRoles?: OrgRole[];
  allowedUserIds?: string[];
}
