# Multi-Tenant User Management

**Priority:** High  
**Dependencies:** Supabase Auth, RLS, 14_PRODUCT_DATA_FLOW.md  
**Status:** Not Started

---

## Overview

Organization-level user management with role-based access control, table sharing, and team collaboration.

**User Story:**
- Admin creates an organization "Springfield High School"
- Admin invites teachers as members with "Editor" role
- Members can share tables within the organization
- Public tables visible to all org members
- Private tables remain user-scoped

**Impact:**
- Enables team collaboration
- Unlocks enterprise pricing tier
- Reduces data duplication across team members
- Supports school/department-level deployments

---

## Database Schema

```sql
-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  settings JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT DEFAULT 'free',  -- free, team, enterprise
  max_members INTEGER DEFAULT 5,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT organizations_slug_valid CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT organizations_tier_valid CHECK (subscription_tier IN ('free', 'team', 'enterprise'))
);

-- Organization members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL DEFAULT 'member',  -- owner, admin, editor, viewer
  
  invitation_token TEXT UNIQUE,
  invitation_expires_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id),
  CONSTRAINT org_members_role_valid CHECK (role IN ('owner', 'admin', 'editor', 'viewer'))
);

-- Table sharing
CREATE TABLE IF NOT EXISTS table_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  permission TEXT NOT NULL DEFAULT 'view',  -- view, edit, admin
  
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  CONSTRAINT table_shares_target CHECK (
    (organization_id IS NOT NULL AND user_id IS NULL) OR
    (organization_id IS NULL AND user_id IS NOT NULL)
  ),
  CONSTRAINT table_shares_permission_valid CHECK (permission IN ('view', 'edit', 'admin'))
);

-- Indexes
CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_token ON organization_members(invitation_token);
CREATE INDEX idx_table_shares_table ON table_shares(table_id);
CREATE INDEX idx_table_shares_org ON table_shares(organization_id);
CREATE INDEX idx_table_shares_user ON table_shares(user_id);

-- Auto-update updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_shares ENABLE ROW LEVEL SECURITY;

-- Users can view orgs they're members of
CREATE POLICY "Members can view their organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Only owners can update organizations
CREATE POLICY "Owners can update their organizations"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

-- Only owners can delete organizations
CREATE POLICY "Owners can delete their organizations"
  ON organizations FOR DELETE
  USING (owner_id = auth.uid());

-- Users can view their memberships
CREATE POLICY "Users can view their memberships"
  ON organization_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Admins can add members
CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Users can view shared tables
CREATE POLICY "Users can view shared tables"
  ON tables FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM table_shares
      WHERE table_shares.table_id = tables.id
        AND (
          table_shares.user_id = auth.uid() OR
          table_shares.organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
          )
        )
        AND (table_shares.expires_at IS NULL OR table_shares.expires_at > NOW())
    )
  );

-- Users can edit tables with edit permission
CREATE POLICY "Users can edit shared tables"
  ON tables FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM table_shares
      WHERE table_shares.table_id = tables.id
        AND (table_shares.user_id = auth.uid() OR table_shares.organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        ))
        AND table_shares.permission IN ('edit', 'admin')
        AND (table_shares.expires_at IS NULL OR table_shares.expires_at > NOW())
    )
  );
```

---

## API Contract

**POST /api/organizations**

Request:
```json
{
  "name": "Springfield High School",
  "slug": "springfield-high"
}
```

Response:
```json
{
  "data": {
    "id": "org-uuid",
    "name": "Springfield High School",
    "slug": "springfield-high",
    "owner_id": "user-uuid",
    "subscription_tier": "free",
    "max_members": 5,
    "created_at": "2025-05-26T12:00:00Z"
  }
}
```

**POST /api/organizations/:id/members**

Request:
```json
{
  "email": "teacher@example.com",
  "role": "editor"
}
```

Response:
```json
{
  "data": {
    "member_id": "member-uuid",
    "user_id": "user-uuid",
    "role": "editor",
    "invitation_sent": true,
    "invitation_token": "token-123",
    "invitation_expires_at": "2025-06-02T12:00:00Z"
  }
}
```

**POST /api/tables/:id/share**

Request:
```json
{
  "organization_id": "org-uuid",
  "permission": "edit",
  "expires_at": "2025-12-31T23:59:59Z"
}
```

Response:
```json
{
  "data": {
    "share_id": "share-uuid",
    "table_id": "table-uuid",
    "organization_id": "org-uuid",
    "permission": "edit",
    "shared_at": "2025-05-26T12:00:00Z"
  }
}
```

**GET /api/organizations/:id/members**

Response:
```json
{
  "data": [
    {
      "id": "member-uuid",
      "user_id": "user-uuid",
      "email": "teacher@example.com",
      "role": "editor",
      "joined_at": "2025-05-20T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "page": 1,
    "per_page": 20
  }
}
```

---

## Type Definitions

```typescript
interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  settings: Record<string, any>;
  subscription_tier: 'free' | 'team' | 'enterprise';
  max_members: number;
  created_at: string;
  updated_at: string;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  invitation_token?: string;
  invitation_expires_at?: string;
  invitation_accepted_at?: string;
  joined_at: string;
}

interface TableShare {
  id: string;
  table_id: string;
  organization_id?: string;
  user_id?: string;
  permission: 'view' | 'edit' | 'admin';
  shared_at: string;
  expires_at?: string;
}

type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';
type SharePermission = 'view' | 'edit' | 'admin';

interface RolePermissions {
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canEditOrganization: boolean;
  canDeleteOrganization: boolean;
  canShareTables: boolean;
  canEditSharedTables: boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canEditOrganization: true,
    canDeleteOrganization: true,
    canShareTables: true,
    canEditSharedTables: true,
  },
  admin: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canEditOrganization: true,
    canDeleteOrganization: false,
    canShareTables: true,
    canEditSharedTables: true,
  },
  editor: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canEditOrganization: false,
    canDeleteOrganization: false,
    canShareTables: true,
    canEditSharedTables: true,
  },
  viewer: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canEditOrganization: false,
    canDeleteOrganization: false,
    canShareTables: false,
    canEditSharedTables: false,
  },
};
```

---

## Implementation Checklist

**Database:**
- [ ] Create `organizations` table
- [ ] Create `organization_members` table
- [ ] Create `table_shares` table
- [ ] Add RLS policies for multi-tenancy
- [ ] Create indexes
- [ ] Test RLS with different user roles

**API Routes:**
- [ ] POST `/api/organizations` - Create organization
- [ ] GET `/api/organizations` - List user organizations
- [ ] GET `/api/organizations/:id` - Get single organization
- [ ] PATCH `/api/organizations/:id` - Update organization
- [ ] DELETE `/api/organizations/:id` - Delete organization
- [ ] GET `/api/organizations/:id/members` - List members
- [ ] POST `/api/organizations/:id/members` - Invite member
- [ ] PATCH `/api/organizations/:id/members/:userId` - Update member role
- [ ] DELETE `/api/organizations/:id/members/:userId` - Remove member
- [ ] POST `/api/tables/:id/share` - Share table
- [ ] GET `/api/tables/:id/shares` - List table shares
- [ ] DELETE `/api/table-shares/:id` - Revoke share

**UI Components:**
- [ ] Organization settings page
- [ ] Member management interface
- [ ] Role selector dropdown
- [ ] Table sharing modal
- [ ] Organization switcher in navbar
- [ ] Shared tables view
- [ ] Invitation accept/decline page
- [ ] Member invitation form

**Permissions Logic:**
- [ ] Implement RBAC middleware
- [ ] Add permission checks in API routes
- [ ] Show/hide UI elements based on role
- [ ] Validate permissions before database writes
- [ ] Audit log for sensitive actions (future)

**Invitations:**
- [ ] Email invitation system (Resend/SendGrid)
- [ ] Invitation token generation (crypto.randomUUID)
- [ ] Invitation expiration logic (7 days default)
- [ ] Accept/decline invitation flow
- [ ] Track pending invitations
- [ ] Resend invitation functionality

**Subscription Management:**
- [ ] Implement member limits by tier
- [ ] Block invitations when limit reached
- [ ] Upgrade flow to increase limits
- [ ] Stripe integration for billing (future)

**Testing:**
- [ ] Test organization CRUD operations
- [ ] Test member invitation flow
- [ ] Test role permissions (all 4 roles)
- [ ] Test table sharing (org-level and user-level)
- [ ] Test RLS policies with different users
- [ ] Test member limit enforcement
- [ ] Load test: 1000 members in single org

---

**Estimated Effort:** 4 weeks  
**Dependencies:** Email service (Resend/SendGrid), Stripe (future)