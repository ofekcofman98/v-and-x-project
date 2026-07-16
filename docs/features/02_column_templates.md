# Column-Template Lists

**Priority:** Medium  
**Dependencies:** 14_PRODUCT_DATA_FLOW.md  
**Status:** Done

---

## Overview

Create reusable column schema templates that can be injected into multiple BaseLists, eliminating repetitive column definition work.

**User Story:**
- User creates a "Student Info Template" with columns: Name, Student ID, Email, Grade Level
- User creates multiple BaseLists (Class 10A, Class 10B) and injects the template
- Template changes propagate to all BaseLists using it (optional auto-sync)
- Public templates available in marketplace for common use cases

**Impact:**
- Reduces setup time for similar BaseLists by 80%
- Ensures schema consistency across organizational units
- Enables template marketplace for community-shared schemas

---

## Database Schema

```sql
-- Column Templates table
CREATE TABLE IF NOT EXISTS column_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- "education", "inventory", "hr", etc.
  
  schema JSONB NOT NULL,  -- { columns: [...] }
  
  is_public BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT column_templates_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Template usage tracking
CREATE TABLE IF NOT EXISTS base_list_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_list_id UUID NOT NULL REFERENCES base_lists(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES column_templates(id) ON DELETE SET NULL,
  
  auto_sync BOOLEAN DEFAULT FALSE,  -- Auto-sync template changes
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(base_list_id, template_id)
);

-- Indexes
CREATE INDEX idx_column_templates_user_id ON column_templates(user_id);
CREATE INDEX idx_column_templates_org_id ON column_templates(organization_id);
CREATE INDEX idx_column_templates_category ON column_templates(category);
CREATE INDEX idx_column_templates_public ON column_templates(is_public);
CREATE INDEX idx_base_list_templates_base_list ON base_list_templates(base_list_id);
CREATE INDEX idx_base_list_templates_template ON base_list_templates(template_id);

-- RLS Policies
ALTER TABLE column_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates and public templates"
  ON column_templates FOR SELECT
  USING (user_id = auth.uid() OR is_public = TRUE);

CREATE POLICY "Users can create own templates"
  ON column_templates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own templates"
  ON column_templates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON column_templates FOR DELETE
  USING (user_id = auth.uid());
```

**Schema JSONB Structure:**

```json
{
  "columns": [
    {
      "id": "name",
      "label": "Name",
      "type": "text",
      "validation": { "required": true }
    },
    {
      "id": "student_id",
      "label": "Student ID",
      "type": "text",
      "validation": { "required": true }
    },
    {
      "id": "email",
      "label": "Email",
      "type": "text",
      "validation": { "pattern": "^[^@]+@[^@]+\\.[^@]+$" }
    },
    {
      "id": "grade_level",
      "label": "Grade Level",
      "type": "number",
      "validation": { "min": 1, "max": 12 }
    }
  ]
}
```

---

## API Contract

**POST /api/column-templates**

Request:
```json
{
  "name": "Student Info Template",
  "description": "Standard student information schema",
  "category": "education",
  "schema": {
    "columns": [
      { "id": "name", "label": "Name", "type": "text" },
      { "id": "student_id", "label": "Student ID", "type": "text" },
      { "id": "email", "label": "Email", "type": "text" },
      { "id": "grade_level", "label": "Grade Level", "type": "number" }
    ]
  },
  "is_public": false
}
```

Response:
```json
{
  "data": {
    "id": "template-uuid",
    "name": "Student Info Template",
    "usage_count": 0,
    "created_at": "2025-05-26T12:00:00Z"
  }
}
```

**GET /api/column-templates**

Query Params: `?category=education&is_public=true`

Response:
```json
{
  "data": [
    {
      "id": "template-uuid",
      "name": "Student Info Template",
      "description": "Standard student information schema",
      "category": "education",
      "is_public": false,
      "usage_count": 5
    }
  ],
  "pagination": {
    "total": 12,
    "page": 1,
    "per_page": 20
  }
}
```

**POST /api/base-lists/:id/apply-template**

Request:
```json
{
  "template_id": "template-uuid",
  "auto_sync": true,
  "merge_strategy": "append"
}
```

Response:
```json
{
  "data": {
    "base_list_id": "list-uuid",
    "template_applied": true,
    "columns_added": 4,
    "conflicts": []
  }
}
```

---

## Type Definitions

```typescript
interface ColumnTemplate {
  id: string;
  user_id: string;
  organization_id?: string;
  name: string;
  description?: string;
  category?: string;
  schema: {
    columns: Array<{
      id: string;
      label: string;
      type: 'text' | 'number' | 'date' | 'boolean';
      validation?: Record<string, any>;
    }>;
  };
  is_public: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface TemplateApplication {
  base_list_id: string;
  template_id: string;
  auto_sync: boolean;
  applied_at: string;
}

type MergeStrategy = 'append' | 'replace';

interface TemplateApplyResult {
  base_list_id: string;
  template_applied: boolean;
  columns_added: number;
  conflicts: Array<{
    column_id: string;
    reason: string;
  }>;
}

type TemplateCategory = 
  | 'education' 
  | 'inventory' 
  | 'hr' 
  | 'finance' 
  | 'healthcare' 
  | 'custom';
```

---

## Implementation Checklist

**Database:**
- [ ] Create `column_templates` table
- [ ] Create `base_list_templates` junction table
- [ ] Add RLS policies for templates
- [ ] Create indexes
- [ ] Add trigger to increment `usage_count` on apply

**API Routes:**
- [ ] POST `/api/column-templates` - Create template
- [ ] GET `/api/column-templates` - List user templates
- [ ] GET `/api/column-templates/public` - List public templates
- [ ] GET `/api/column-templates/:id` - Get single template
- [ ] PATCH `/api/column-templates/:id` - Update template
- [ ] DELETE `/api/column-templates/:id` - Delete template
- [ ] POST `/api/base-lists/:id/apply-template` - Apply template
- [ ] GET `/api/base-lists/:id/templates` - List applied templates

**UI Components:**
- [ ] Template library browser with categories
- [ ] Template creation dialog
- [ ] Template injection UI in BaseList creator
- [ ] Category filter dropdown
- [ ] Search functionality
- [ ] Public template marketplace view
- [ ] Template preview modal
- [ ] "Save as Template" button in BaseList editor

**Template Application Logic:**
- [ ] Implement `append` merge strategy (add new columns)
- [ ] Implement `replace` merge strategy (replace all columns)
- [ ] Handle column ID conflicts (auto-rename)
- [ ] Validate template schema before applying
- [ ] Show preview of changes before confirmation

**Auto-Sync Logic:**
- [ ] Background job to sync template changes
- [ ] Detect template updates
- [ ] Apply updates to auto-synced BaseLists
- [ ] Conflict resolution strategy (keep user changes vs apply template)
- [ ] User notification on template updates
- [ ] Opt-out mechanism for auto-sync

**Validation:**
- [ ] Validate template schema structure
- [ ] Prevent circular dependencies
- [ ] Check for duplicate column IDs
- [ ] Validate column types
- [ ] Ensure at least one column in template

**Testing:**
- [ ] Test template creation
- [ ] Test template application (append strategy)
- [ ] Test template application (replace strategy)
- [ ] Test auto-sync functionality
- [ ] Test public template marketplace
- [ ] Test permission boundaries (RLS)

---

**Estimated Effort:** 2 weeks  
**Dependencies:** Multi-tenant auth (optional), Organizations table (optional)