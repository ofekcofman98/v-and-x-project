# VocalGrid - Database Design

**Chapter:** 03  
**Dependencies:** 02_ARCHITECTURE.md  
**Related:** 04_STATE_MANAGEMENT.md, 11_API_ROUTES.md

---

## Table of Contents

1. [Database Technology](#1-database-technology)
   - 1.1 [PostgreSQL via Supabase](#11-postgresql-via-supabase)

2. [Schema Design](#2-schema-design)
   - 2.1 [Entity-Relationship Diagram](#21-entity-relationship-diagram)
   - 2.2 [Design Rationale](#22-design-rationale)

3. [Table Schemas (SQL)](#3-table-schemas-sql)
   - 3.1 [Tables Table](#31-tables-table)
   - 3.2 [Table Data Table](#32-table-data-table)

4. [JSONB Schema Formats](#4-jsonb-schema-formats)
   - 4.1 [tables.schema Format](#41-tablesschema-format)
   - 4.2 [table_data.value Format](#42-table_datavalue-format)
   - 4.3 [tables.settings Format](#43-tablessettings-format)

5. [Row Level Security (RLS)](#5-row-level-security-rls)
   - 5.1 [Enable RLS](#51-enable-rls)
   - 5.2 [Tables Policies](#52-tables-policies)
   - 5.3 [Table Data Policies](#53-table-data-policies)
   - 5.4 [Testing RLS Policies](#54-testing-rls-policies)

6. [Common Queries](#6-common-queries)
   - 6.1 [Fetch All Tables for User](#61-fetch-all-tables-for-user)
   - 6.2 [Fetch Table with Data](#62-fetch-table-with-data)
   - 6.3 [Upsert Cell Value](#63-upsert-cell-value)
   - 6.4 [Delete Row](#64-delete-row)
   - 6.5 [Delete Column](#65-delete-column)
   - 6.6 [Transform EAV to 2D Grid (Client-side)](#66-transform-eav-to-2d-grid-client-side)

7. [Data Migration & Seeding](#7-data-migration--seeding)
   - 7.1 [Initial Setup Script](#71-initial-setup-script)
   - 7.2 [Demo Data Seed](#72-demo-data-seed)

8. [Performance Optimization](#8-performance-optimization)
   - 8.1 [Query Optimization](#81-query-optimization)
   - 8.2 [Index Strategy](#82-index-strategy)
   - 8.3 [Connection Pooling](#83-connection-pooling)

9. [Backup & Recovery](#9-backup--recovery)
   - 9.1 [Automated Backups (Supabase)](#91-automated-backups-supabase)
   - 9.2 [Manual Backup](#92-manual-backup)
   - 9.3 [Export User Data (GDPR Compliance)](#93-export-user-data-gdpr-compliance)

10. [Database Checklist](#10-database-checklist)

---


## 1. Database Technology

### 1.1 PostgreSQL via Supabase

**Why PostgreSQL:**
- ✅ Relational model (perfect for tabular data)
- ✅ ACID compliance (data integrity)
- ✅ JSON support (flexible schema storage)
- ✅ Mature, battle-tested
- ✅ Excellent tooling

**Why Supabase:**
- ✅ Managed PostgreSQL (no ops)
- ✅ Row Level Security (RLS)
- ✅ Real-time subscriptions
- ✅ Built-in auth
- ✅ Auto-generated REST API
- ✅ Generous free tier

**Free Tier Limits:**
- 500MB database storage
- 2GB bandwidth/month
- 50K monthly active users
- 500 queries/second

---

## 2. Schema Design

### 2.1 Entity-Relationship Diagram
```
┌─────────────────────────────────────────┐
│            auth.users                   │
│         (Supabase managed)              │
├─────────────────────────────────────────┤
│ id            UUID (PK)                 │
│ email         TEXT                      │
│ created_at    TIMESTAMPTZ               │
└───────────────┬─────────────────────────┘
                │
                │ 1:N
                │
┌───────────────▼─────────────────────────┐
│            tables                       │
├─────────────────────────────────────────┤
│ id            UUID (PK)                 │
│ user_id       UUID (FK → auth.users)    │
│ name          TEXT                      │
│ description   TEXT                      │
│ schema        JSONB                     │
│ settings      JSONB                     │
│ created_at    TIMESTAMPTZ               │
│ updated_at    TIMESTAMPTZ               │
└───────────────┬─────────────────────────┘
                │
                │ 1:N
                │
┌───────────────▼─────────────────────────┐
│          table_data                     │
├─────────────────────────────────────────┤
│ id            UUID (PK)                 │
│ table_id      UUID (FK → tables)        │
│ row_id        TEXT                      │
│ column_id     TEXT                      │
│ value         JSONB                     │
│ created_at    TIMESTAMPTZ               │
│ updated_at    TIMESTAMPTZ               │
│                                         │
│ UNIQUE(table_id, row_id, column_id)     │
└─────────────────────────────────────────┘
```

### 2.2 Design Rationale

**Why EAV (Entity-Attribute-Value) Pattern:**

Traditional approach (one column per attribute):
```sql
CREATE TABLE student_grades (
  student_id UUID,
  quiz_1 INTEGER,
  quiz_2 INTEGER,
  quiz_3 INTEGER,
  -- Need to ALTER TABLE for new columns!
);
```

**Problem:** Schema changes require migrations.

**VocalGrid approach (EAV):**
```sql
CREATE TABLE table_data (
  table_id UUID,
  row_id TEXT,      -- "john_smith"
  column_id TEXT,   -- "quiz_1"
  value JSONB       -- {"v": 85}
);
```

**Benefits:**
- ✅ Dynamic schema (add columns without migrations)
- ✅ Flexible (supports any data type in JSONB)
- ✅ Sparse data (only store non-null values)

**Trade-offs:**
- ⚠️ More complex queries (need pivoting for display)
- ⚠️ Slightly slower than columnar (acceptable for <1K rows)

---

## 3. Table Schemas (SQL)

### 3.1 Tables Table
```sql
-- ═══════════════════════════════════════════════════════════
-- TABLES: Store table metadata and schema definitions
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tables (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key to auth.users (Supabase Auth)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Table metadata
  name TEXT NOT NULL,
  description TEXT,
  
  -- Dynamic schema definition (JSONB)
  -- Structure: { columns: [...], rows: [...] }
  schema JSONB NOT NULL,
  
  -- User preferences and UI settings
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════

-- Fast lookup by user
CREATE INDEX idx_tables_user_id ON tables(user_id);

-- Fast lookup by name (for search)
CREATE INDEX idx_tables_name ON tables(name);

-- GIN index for JSONB schema queries (optional, for advanced search)
CREATE INDEX idx_tables_schema ON tables USING GIN (schema);

-- ═══════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tables_updated_at
  BEFORE UPDATE ON tables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- CONSTRAINTS
-- ═══════════════════════════════════════════════════════════

-- Ensure name is not empty
ALTER TABLE tables ADD CONSTRAINT tables_name_not_empty
  CHECK (length(trim(name)) > 0);

-- Ensure schema is valid JSON object
ALTER TABLE tables ADD CONSTRAINT tables_schema_is_object
  CHECK (jsonb_typeof(schema) = 'object');
```

### 3.2 Table Data Table
```sql
-- ═══════════════════════════════════════════════════════════
-- TABLE_DATA: Store actual cell values (EAV pattern)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS table_data (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key to tables
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  
  -- EAV structure
  row_id TEXT NOT NULL,       -- Entity identifier (e.g., "john_smith")
  column_id TEXT NOT NULL,    -- Attribute identifier (e.g., "quiz_1")
  value JSONB NOT NULL,       -- Value (e.g., {"v": 85})
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique combination
  UNIQUE(table_id, row_id, column_id)
);

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════

-- Fast lookup by table
CREATE INDEX idx_table_data_table_id ON table_data(table_id);

-- Fast lookup by row (for fetching all columns of a row)
CREATE INDEX idx_table_data_row_id ON table_data(table_id, row_id);

-- Fast lookup by column (for column-wise operations)
CREATE INDEX idx_table_data_column_id ON table_data(table_id, column_id);

-- Composite index for common queries
CREATE INDEX idx_table_data_composite ON table_data(table_id, row_id, column_id);

-- ═══════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════

CREATE TRIGGER update_table_data_updated_at
  BEFORE UPDATE ON table_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- CONSTRAINTS
-- ═══════════════════════════════════════════════════════════

-- Ensure row_id and column_id are not empty
ALTER TABLE table_data ADD CONSTRAINT table_data_row_id_not_empty
  CHECK (length(trim(row_id)) > 0);

ALTER TABLE table_data ADD CONSTRAINT table_data_column_id_not_empty
  CHECK (length(trim(column_id)) > 0);

-- Ensure value is a JSON object
ALTER TABLE table_data ADD CONSTRAINT table_data_value_is_object
  CHECK (jsonb_typeof(value) = 'object');
```

---

## 4. JSONB Schema Formats

### 4.1 tables.schema Format
```typescript
// TypeScript interface for schema validation

interface TableSchema {
  columns: ColumnDefinition[];
  rows: RowDefinition[];
}

interface ColumnDefinition {
  id: string;              // Unique identifier (e.g., "quiz_1")
  label: string;           // Display name (e.g., "Quiz 1")
  type: 'text' | 'number' | 'boolean' | 'date';
  required?: boolean;      // Default: false
  validation?: ValidationRules;
  metadata?: Record<string, any>;  // Future: color, icon, etc.
}

interface ValidationRules {
  // For type: 'number'
  min?: number;
  max?: number;
  decimals?: number;
  
  // For type: 'text'
  minLength?: number;
  maxLength?: number;
  pattern?: string;        // Regex pattern
  
  // For type: 'date'
  minDate?: string;        // ISO format
  maxDate?: string;
}

interface RowDefinition {
  id: string;              // Unique identifier (e.g., "john_smith")
  label: string;           // Display name (e.g., "John Smith")
  metadata?: Record<string, any>;  // Future: photo, email, etc.
}

// Example 1: Student grades table
const studentGradesSchema: TableSchema = {
  columns: [
    {
      id: 'name',
      label: 'Student Name',
      type: 'text',
      required: true,
    },
    {
      id: 'quiz_1',
      label: 'Quiz 1',
      type: 'number',
      validation: {
        min: 0,
        max: 100,
        decimals: 0,
      },
    },
    {
      id: 'quiz_2',
      label: 'Quiz 2',
      type: 'number',
      validation: {
        min: 0,
        max: 100,
        decimals: 0,
      },
    },
    {
      id: 'present',
      label: 'Present Today',
      type: 'boolean',
    },
  ],
  rows: [
    { id: 'john_smith', label: 'John Smith' },
    { id: 'sarah_jones', label: 'Sarah Jones' },
    { id: 'mike_brown', label: 'Mike Brown' },
  ],
};

// Example 2: Inventory table
const inventorySchema: TableSchema = {
  columns: [
    {
      id: 'sku',
      label: 'SKU',
      type: 'text',
      required: true,
    },
    {
      id: 'product_name',
      label: 'Product Name',
      type: 'text',
      required: true,
    },
    {
      id: 'quantity',
      label: 'Quantity',
      type: 'number',
      validation: {
        min: 0,
        decimals: 0,
      },
    },
    {
      id: 'last_counted',
      label: 'Last Counted',
      type: 'date',
    },
  ],
  rows: [
    { id: 'sku_12345', label: 'SKU-12345' },
    { id: 'sku_67890', label: 'SKU-67890' },
  ],
};
```

### 4.2 table_data.value Format
```typescript
// Value structure for different types

// Type: number
{
  "v": 85
}

// Type: text
{
  "v": "Excellent work"
}

// Type: boolean
{
  "v": true
}

// Type: date
{
  "v": "2025-02-11T00:00:00Z"  // ISO 8601
}

// Future: Rich metadata
{
  "v": 85,
  "m": {
    "enteredBy": "voice",           // "voice" | "manual" | "import"
    "confidence": 0.95,             // For voice entries
    "enteredAt": "2025-02-11T10:30:00Z",
    "editedBy": "user_id",
    "editedAt": "2025-02-11T11:00:00Z"
  }
}
```

### 4.3 tables.settings Format
```typescript
// User preferences and UI settings

interface TableSettings {
  // Voice settings
  voice?: {
    defaultMode?: 'column-first' | 'row-first';
    autoAdvanceDelay?: number;      // ms
    confirmationThreshold?: number; // 0-1 (confidence)
    feedbackEnabled?: boolean;      // TTS feedback
  };
  
  // Display settings
  display?: {
    theme?: 'light' | 'dark';
    fontSize?: 'small' | 'medium' | 'large';
    highlightColor?: string;        // Hex color
    showConfidence?: boolean;       // Show confidence scores
  };
  
  // Export settings
  export?: {
    defaultFormat?: 'csv' | 'xlsx';
    includeMetadata?: boolean;
  };
}

// Example:
const exampleSettings: TableSettings = {
  voice: {
    defaultMode: 'column-first',
    autoAdvanceDelay: 2000,
    confirmationThreshold: 0.85,
    feedbackEnabled: false,
  },
  display: {
    theme: 'light',
    fontSize: 'medium',
    highlightColor: '#3b82f6',
    showConfidence: true,
  },
  export: {
    defaultFormat: 'xlsx',
    includeMetadata: false,
  },
};
```

---

## 5. Row Level Security (RLS)

### 5.1 Enable RLS
```sql
-- ═══════════════════════════════════════════════════════════
-- ENABLE ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_data ENABLE ROW LEVEL SECURITY;

-- By default, all access is denied
-- Must create policies to grant access
```

### 5.2 Tables Policies
```sql
-- ═══════════════════════════════════════════════════════════
-- TABLES RLS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Users can SELECT their own tables
CREATE POLICY "Users can view own tables"
  ON tables
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can INSERT their own tables
CREATE POLICY "Users can create own tables"
  ON tables
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own tables
CREATE POLICY "Users can update own tables"
  ON tables
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own tables
CREATE POLICY "Users can delete own tables"
  ON tables
  FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- POLICY EXPLANATION
-- ═══════════════════════════════════════════════════════════

-- USING clause: Applied to existing rows (SELECT, UPDATE, DELETE)
--   → Filters which rows the user can see/modify

-- WITH CHECK clause: Applied to new/modified rows (INSERT, UPDATE)
--   → Validates the row being inserted/updated

-- auth.uid(): Built-in Supabase function
--   → Returns the UUID of the currently authenticated user
--   → Returns NULL if not authenticated
```

### 5.3 Table Data Policies
```sql
-- ═══════════════════════════════════════════════════════════
-- TABLE_DATA RLS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Users can SELECT data from their own tables
CREATE POLICY "Users can view own table data"
  ON table_data
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tables
      WHERE tables.id = table_data.table_id
        AND tables.user_id = auth.uid()
    )
  );

-- Users can INSERT data into their own tables
CREATE POLICY "Users can insert own table data"
  ON table_data
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tables
      WHERE tables.id = table_data.table_id
        AND tables.user_id = auth.uid()
    )
  );

-- Users can UPDATE data in their own tables
CREATE POLICY "Users can update own table data"
  ON table_data
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM tables
      WHERE tables.id = table_data.table_id
        AND tables.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tables
      WHERE tables.id = table_data.table_id
        AND tables.user_id = auth.uid()
    )
  );

-- Users can DELETE data from their own tables
CREATE POLICY "Users can delete own table data"
  ON table_data
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tables
      WHERE tables.id = table_data.table_id
        AND tables.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════
-- POLICY EXPLANATION
-- ═══════════════════════════════════════════════════════════

-- The EXISTS subquery checks if:
-- 1. The table_data.table_id references a table in the tables table
-- 2. That table belongs to the current user (auth.uid())

-- This ensures users can only access data from their own tables
-- even though table_data doesn't have a direct user_id column
```

### 5.4 Testing RLS Policies
```sql
-- ═══════════════════════════════════════════════════════════
-- TEST RLS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Create test users (via Supabase Auth UI or API)
-- user_1: 'user1@example.com'
-- user_2: 'user2@example.com'

-- Insert test data as user_1
INSERT INTO tables (user_id, name, schema)
VALUES (
  'user_1_uuid',
  'User 1 Table',
  '{"columns": [], "rows": []}'::jsonb
);

-- Insert test data as user_2
INSERT INTO tables (user_id, name, schema)
VALUES (
  'user_2_uuid',
  'User 2 Table',
  '{"columns": [], "rows": []}'::jsonb
);

-- ═══════════════════════════════════════════════════════════
-- TEST: User 1 can only see their own table
-- ═══════════════════════════════════════════════════════════

-- Set session to user_1
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'user_1_uuid';

SELECT * FROM tables;
-- Expected: Only "User 1 Table" returned

-- ═══════════════════════════════════════════════════════════
-- TEST: User 1 cannot see user 2's table
-- ═══════════════════════════════════════════════════════════

SELECT * FROM tables WHERE user_id = 'user_2_uuid';
-- Expected: Empty result (RLS blocks access)

-- ═══════════════════════════════════════════════════════════
-- TEST: User 1 cannot update user 2's table
-- ═══════════════════════════════════════════════════════════

UPDATE tables SET name = 'Hacked!' WHERE user_id = 'user_2_uuid';
-- Expected: 0 rows updated (RLS blocks modification)
```

---

## 6. Common Queries

### 6.1 Fetch All Tables for User
```sql
-- Get all tables for the authenticated user
SELECT
  id,
  name,
  description,
  schema,
  settings,
  created_at,
  updated_at
FROM tables
WHERE user_id = auth.uid()
ORDER BY created_at DESC;
```

**TypeScript (Supabase client):**
```typescript
const { data, error } = await supabase
  .from('tables')
  .select('*')
  .order('created_at', { ascending: false });
```

### 6.2 Fetch Table with Data
```sql
-- Get table metadata
SELECT * FROM tables WHERE id = :table_id;

-- Get all data for the table
SELECT
  row_id,
  column_id,
  value
FROM table_data
WHERE table_id = :table_id;
```

**TypeScript (Supabase client):**
```typescript
// Fetch table schema
const { data: table } = await supabase
  .from('tables')
  .select('*')
  .eq('id', tableId)
  .single();

// Fetch table data
const { data: tableData } = await supabase
  .from('table_data')
  .select('*')
  .eq('table_id', tableId);
```

### 6.3 Upsert Cell Value
```sql
-- Insert or update a cell value
INSERT INTO table_data (table_id, row_id, column_id, value)
VALUES (:table_id, :row_id, :column_id, :value)
ON CONFLICT (table_id, row_id, column_id)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
```

**TypeScript (Supabase client):**
```typescript
const { data, error } = await supabase
  .from('table_data')
  .upsert({
    table_id: tableId,
    row_id: rowId,
    column_id: columnId,
    value: { v: value },
  })
  .select()
  .single();
```

### 6.4 Delete Row
```sql
-- Delete all cells for a specific row
DELETE FROM table_data
WHERE table_id = :table_id
  AND row_id = :row_id;
```

**TypeScript (Supabase client):**
```typescript
const { error } = await supabase
  .from('table_data')
  .delete()
  .eq('table_id', tableId)
  .eq('row_id', rowId);
```

### 6.5 Delete Column
```sql
-- Delete all cells for a specific column
DELETE FROM table_data
WHERE table_id = :table_id
  AND column_id = :column_id;

-- Also update the table schema to remove the column definition
UPDATE tables
SET schema = schema - 'columns' || 
  jsonb_build_object(
    'columns',
    (SELECT jsonb_agg(col)
     FROM jsonb_array_elements(schema->'columns') col
     WHERE col->>'id' != :column_id)
  )
WHERE id = :table_id;
```

### 6.6 Transform EAV to 2D Grid (Client-side)
```typescript
// Utility function to pivot EAV data into a grid

interface CellData {
  table_id: string;
  row_id: string;
  column_id: string;
  value: { v: any };
}

interface GridData {
  [rowId: string]: {
    [columnId: string]: any;
  };
}

function pivotToGrid(data: CellData[]): GridData {
  const grid: GridData = {};
  
  for (const cell of data) {
    if (!grid[cell.row_id]) {
      grid[cell.row_id] = {};
    }
    grid[cell.row_id][cell.column_id] = cell.value.v;
  }
  
  return grid;
}

// Usage:
const eavData = [
  { row_id: 'john', column_id: 'quiz_1', value: { v: 85 } },
  { row_id: 'john', column_id: 'quiz_2', value: { v: 90 } },
  { row_id: 'sarah', column_id: 'quiz_1', value: { v: 92 } },
];

const grid = pivotToGrid(eavData);
// Result:
// {
//   john: { quiz_1: 85, quiz_2: 90 },
//   sarah: { quiz_1: 92 }
// }
```

---

## 7. Data Migration & Seeding

### 7.1 Initial Setup Script
```sql
-- ═══════════════════════════════════════════════════════════
-- VOCALGRID DATABASE SETUP
-- Run this script once to initialize the database
-- ═══════════════════════════════════════════════════════════

-- Create tables
\i 001_create_tables.sql
\i 002_create_table_data.sql

-- Create indexes
\i 003_create_indexes.sql

-- Create triggers
\i 004_create_triggers.sql

-- Enable RLS
\i 005_enable_rls.sql

-- Create RLS policies
\i 006_create_policies.sql

-- Seed demo data (optional)
\i 007_seed_demo_data.sql
```

### 7.2 Demo Data Seed
```sql
-- ═══════════════════════════════════════════════════════════
-- SEED DEMO DATA
-- Creates a sample table for new users to explore
-- ═══════════════════════════════════════════════════════════

-- This would be run via Supabase Edge Function on user signup

CREATE OR REPLACE FUNCTION create_demo_table_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_id UUID;
BEGIN
  -- Insert demo table
  INSERT INTO tables (user_id, name, description, schema)
  VALUES (
    p_user_id,
    'Demo: Student Grades',
    'A sample table to try voice input',
    '{
      "columns": [
        {
          "id": "name",
          "label": "Student Name",
          "type": "text",
          "required": true
        },
        {
          "id": "quiz_1",
          "label": "Quiz 1",
          "type": "number",
          "validation": {"min": 0, "max": 100}
        },
        {
          "id": "quiz_2",
          "label": "Quiz 2",
          "type": "number",
          "validation": {"min": 0, "max": 100}
        }
      ],
      "rows": [
        {"id": "alice", "label": "Alice Smith"},
        {"id": "bob", "label": "Bob Johnson"},
        {"id": "charlie", "label": "Charlie Brown"}
      ]
    }'::jsonb
  )
  RETURNING id INTO v_table_id;
  
  -- Insert sample data
  INSERT INTO table_data (table_id, row_id, column_id, value)
  VALUES
    (v_table_id, 'alice', 'quiz_1', '{"v": 85}'::jsonb),
    (v_table_id, 'alice', 'quiz_2', '{"v": 90}'::jsonb),
    (v_table_id, 'bob', 'quiz_1', '{"v": 78}'::jsonb);
  
  RETURN v_table_id;
END;
$$;

-- Usage: Call this function when a new user signs up
-- SELECT create_demo_table_for_user(auth.uid());
```

---

## 8. Performance Optimization

### 8.1 Query Optimization
```sql
-- ═══════════════════════════════════════════════════════════
-- ANALYZE QUERY PERFORMANCE
-- ═══════════════════════════════════════════════════════════

-- Check slow queries
EXPLAIN ANALYZE
SELECT * FROM table_data WHERE table_id = 'xxx';

-- Example output:
-- Seq Scan on table_data (cost=0.00..15.50 rows=5 width=100)
--   Filter: (table_id = 'xxx')
-- Planning Time: 0.123 ms
-- Execution Time: 0.456 ms

-- If "Seq Scan" appears for large tables, add index!

-- ═══════════════════════════════════════════════════════════
-- VACUUM AND ANALYZE
-- ═══════════════════════════════════════════════════════════

-- Reclaim storage and update statistics
VACUUM ANALYZE tables;
VACUUM ANALYZE table_data;

-- Supabase runs this automatically, but can run manually for testing
```

### 8.2 Index Strategy
```sql
-- ═══════════════════════════════════════════════════════════
-- COVERING INDEX (Avoid table lookups)
-- ═══════════════════════════════════════════════════════════

-- If you frequently query:
-- SELECT row_id, column_id, value FROM table_data WHERE table_id = ?

-- Create covering index:
CREATE INDEX idx_table_data_covering
  ON table_data(table_id)
  INCLUDE (row_id, column_id, value);

-- Postgres can satisfy query from index alone (no table lookup)

-- ═══════════════════════════════════════════════════════════
-- PARTIAL INDEX (For common filters)
-- ═══════════════════════════════════════════════════════════

-- If you only query recent data:
CREATE INDEX idx_table_data_recent
  ON table_data(table_id, created_at)
  WHERE created_at > NOW() - INTERVAL '30 days';

-- Smaller index, faster queries for recent data
```

### 8.3 Connection Pooling

Supabase handles this automatically via PgBouncer.

**Configuration (Supabase dashboard):**
- Transaction mode (default): Best for serverless
- Session mode: For long-running connections

**No action needed for MVP**, but good to know for scaling.

---

## 9. Backup & Recovery

### 9.1 Automated Backups (Supabase)

**Free Tier:**
- Daily automated backups
- 7-day retention
- One-click restore via Supabase dashboard

**Pro Tier ($25/month):**
- Point-in-time recovery (PITR)
- Up to 30 days retention
- Hourly backups

### 9.2 Manual Backup
```bash
# Export database to SQL file (via Supabase CLI)
supabase db dump > backup_$(date +%Y%m%d).sql

# Restore from backup
supabase db reset --db-url <connection-string>
psql <connection-string> < backup_20250211.sql
```

### 9.3 Export User Data (GDPR Compliance)
```sql
-- Export all data for a specific user
WITH user_tables AS (
  SELECT id FROM tables WHERE user_id = :user_id
)
SELECT
  t.id AS table_id,
  t.name AS table_name,
  t.schema,
  td.row_id,
  td.column_id,
  td.value
FROM tables t
LEFT JOIN table_data td ON td.table_id = t.id
WHERE t.user_id = :user_id;

-- Export to JSON
COPY (
  -- query above
) TO '/tmp/user_data.json';
```

---

## 10. Database Checklist

**Before Launch:**
- [ ] All tables created
- [ ] Indexes added
- [ ] RLS enabled
- [ ] RLS policies tested
- [ ] Triggers working (updated_at)
- [ ] Constraints enforced
- [ ] Demo data seed function created
- [ ] Backup strategy documented
- [ ] Query performance tested (EXPLAIN ANALYZE)
- [ ] Connection pooling configured (Supabase default)

**Monitoring:**
- [ ] Set up alerts for high query latency
- [ ] Monitor database size (free tier: 500MB)
- [ ] Track slow queries
- [ ] Review RLS policy performance

---

*End of Database Documentation*