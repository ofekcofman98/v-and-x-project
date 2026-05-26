# Private Columns

**Priority:** Medium  
**Dependencies:** Multi-Tenant User Management, RLS, 14_PRODUCT_DATA_FLOW.md  
**Status:** Not Started

---

## Overview

Column-level access control where certain columns are visible only to users with specific roles.

**User Story:**
- Admin creates a table with columns: Name, Score, Teacher Notes
- "Teacher Notes" marked as private (Admin/Editor only)
- Students viewing the table cannot see "Teacher Notes" column
- Data remains secure at database level via RLS
- API responses automatically filter unauthorized columns

**Impact:**
- Enables sensitive data protection
- Supports regulatory compliance (FERPA, GDPR)
- Unlocks education/enterprise use cases
- Enables gradebook-style privacy controls

---

## Database Schema

```sql
-- Extend tables.schema to include column-level permissions
-- No new tables - store in existing schema JSONB

-- Example schema structure stored in tables.schema:
{
  "columns": [
    {
      "id": "teacher_notes",
      "label": "Teacher Notes",
      "type": "text",
      "access": {
        "visibility": "private",
        "allowed_roles": ["admin", "editor"],
        "allowed_users": []
      }
    },
    {
      "id": "student_name",
      "label": "Student Name",
      "type": "text",
      "access": {
        "visibility": "public"
      }
    }
  ]
}

-- RLS policy for table_data to enforce column-level access
CREATE POLICY "Users can only access authorized columns"
  ON table_data FOR SELECT
  USING (
    -- Check if column is public OR user has permission
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_data.table_id
        AND (
          -- Column is public
          (t.schema->'columns' @> jsonb_build_array(
            jsonb_build_object('id', table_data.column_id, 'access', jsonb_build_object('visibility', 'public'))
          ))
          OR
          -- User has role permission
          auth.uid() IN (
            SELECT om.user_id
            FROM organization_members om
            JOIN table_shares ts ON ts.organization_id = om.organization_id
            WHERE ts.table_id = t.id
              AND om.role = ANY(
                SELECT jsonb_array_elements_text(
                  (
                    SELECT col->'access'->'allowed_roles'
                    FROM jsonb_array_elements(t.schema->'columns') col
                    WHERE col->>'id' = table_data.column_id
                  )
                )
              )
          )
          OR
          -- User is explicitly allowed
          auth.uid()::text = ANY(
            SELECT jsonb_array_elements_text(
              (
                SELECT col->'access'->'allowed_users'
                FROM jsonb_array_elements(t.schema->'columns') col
                WHERE col->>'id' = table_data.column_id
              )
            )
          )
          OR
          -- User is table owner
          t.user_id = auth.uid()
        )
    )
  );
```

---

## API Contract

**PATCH /api/tables/:id/columns/:columnId/access**

Request:
```json
{
  "visibility": "private",
  "allowed_roles": ["admin", "editor"],
  "allowed_users": ["user-uuid-1", "user-uuid-2"]
}
```

Response:
```json
{
  "data": {
    "column_id": "teacher_notes",
    "visibility": "private",
    "allowed_roles": ["admin", "editor"],
    "allowed_users": ["user-uuid-1", "user-uuid-2"]
  }
}
```

**GET /api/tables/:id/accessible-columns**

Response (filtered by user's role):
```json
{
  "data": {
    "columns": [
      {
        "id": "student_name",
        "label": "Student Name",
        "type": "text",
        "access": { "visibility": "public" }
      }
    ],
    "hidden_columns": ["teacher_notes"]
  }
}
```

**Middleware to filter columns in GET /api/tables/:id:**

```typescript
// Before returning table data, filter columns based on user permissions
const accessibleColumns = await getAccessibleColumns(tableId, userId);
const filteredTableData = tableData.filter(
  (cell) => accessibleColumns.includes(cell.column_id)
);
```

---

## Type Definitions

```typescript
type ColumnVisibility = 'public' | 'private' | 'restricted';

interface ColumnAccess {
  visibility: ColumnVisibility;
  allowed_roles?: UserRole[];
  allowed_users?: string[];  // User IDs
}

interface PrivateColumn extends ColumnDef {
  access: ColumnAccess;
}

interface ColumnPermissionCheck {
  columnId: string;
  hasAccess: boolean;
  reason?: 'public' | 'role_match' | 'user_match' | 'owner' | 'denied';
}

interface ColumnAccessUpdate {
  visibility: ColumnVisibility;
  allowed_roles?: UserRole[];
  allowed_users?: string[];
}
```

---

## Implementation Checklist

**Database:**
- [ ] Extend column schema to include `access` field
- [ ] Add RLS policy for column-level access on `table_data`
- [ ] Test RLS with different user roles
- [ ] Ensure RLS performance with large datasets

**API Routes:**
- [ ] PATCH `/api/tables/:id/columns/:columnId/access` - Update column access
- [ ] GET `/api/tables/:id/accessible-columns` - Get filtered columns
- [ ] Middleware to filter columns in all table responses
- [ ] Validation: ensure user has permission to modify access

**Backend Logic:**
- [ ] Create `getAccessibleColumns(tableId, userId)` utility
- [ ] Filter table_data responses based on user permissions
- [ ] Check user role in organization (if applicable)
- [ ] Check user ID in allowed_users list
- [ ] Check if user is table owner

**UI Components:**
- [ ] Private column indicator (lock icon in header)
- [ ] Access control modal/dialog
- [ ] Role selector for column permissions
- [ ] User selector for column permissions
- [ ] "You don't have access" placeholder for private columns
- [ ] Visual distinction for private columns in schema editor

**Permission Checks:**
```typescript
async function canAccessColumn(
  columnId: string,
  tableId: string,
  userId: string
): Promise<boolean> {
  // 1. Check if user is table owner
  // 2. Check if column is public
  // 3. Check if user has required role
  // 4. Check if user is in allowed_users list
}
```

**Security:**
- [ ] Prevent unauthorized column access via API
- [ ] Prevent unauthorized column updates
- [ ] Sanitize API responses (remove private columns)
- [ ] Rate limit permission checks
- [ ] Add unit tests for RLS policies
- [ ] Audit log for private column access (future)

**Testing:**
- [ ] Test public column access (all users)
- [ ] Test private column access (admin/editor only)
- [ ] Test private column access (specific users)
- [ ] Test column filtering in API responses
- [ ] Test permission inheritance in shared tables
- [ ] Test RLS policy with 1000+ rows
- [ ] Test concurrent access with different users

**Edge Cases:**
- [ ] Handle column access changes while user is viewing table
- [ ] Handle user role changes while viewing table
- [ ] Handle organization member removal
- [ ] Prevent user from locking themselves out (owner always has access)

---

**Estimated Effort:** 3 weeks  
**Dependencies:** Multi-Tenant User Management (Feature 5)