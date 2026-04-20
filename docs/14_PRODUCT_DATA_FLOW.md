# VocalGrid - Product Data Flow & User Journey

**Chapter:** 14  
**Dependencies:** 02_ARCHITECTURE.md, 03_DATABASE.md, 07_MATCHING_ENGINE.md  
**Related:** 08_UI_COMPONENTS.md, 11_API_ROUTES.md

---

## Table of Contents

1. [Product Vision & Data Model Philosophy](#1-product-vision--data-model-philosophy)
   - 1.1 [Separation of Concerns: Lists vs Tables](#11-separation-of-concerns-lists-vs-tables)
   - 1.2 [Representative Column Concept](#12-representative-column-concept)
   - 1.3 [Creation Methods](#13-creation-methods)

2. [Conceptual Data Model](#2-conceptual-data-model)
   - 2.1 [Entity Relationship Diagram](#21-entity-relationship-diagram)
   - 2.2 [Database Schema (Supabase/PostgreSQL)](#22-database-schema-supabasepostgresql)
   - 2.3 [TypeScript Interfaces](#23-typescript-interfaces)

3. [User Journey: Creating a Base List](#3-user-journey-creating-a-base-list)
   - 3.1 [Method 1: Interactive UI Creation](#31-method-1-interactive-ui-creation)
   - 3.2 [Method 2: CSV Import](#32-method-2-csv-import)
   - 3.3 [Selecting Representative Column](#33-selecting-representative-column)

4. [User Journey: Creating a Table](#4-user-journey-creating-a-table)
   - 4.1 [Method 1: Table from Base List](#41-method-1-table-from-base-list)
   - 4.2 [Method 2: Table from Scratch](#42-method-2-table-from-scratch)
   - 4.3 [Adding Data Columns](#43-adding-data-columns)

5. [CSV Import Pipeline](#5-csv-import-pipeline)
   - 5.1 [File Upload & Parsing](#51-file-upload--parsing)
   - 5.2 [Preview & Validation](#52-preview--validation)
   - 5.3 [Column Mapping UI](#53-column-mapping-ui)
   - 5.4 [Representative Column Selection](#54-representative-column-selection)
   - 5.5 [Import Confirmation & Execution](#55-import-confirmation--execution)

6. [Integration with Voice Engine](#6-integration-with-voice-engine)
   - 6.1 [Schema Transformation](#61-schema-transformation)
   - 6.2 [Representative Column → Matching Engine](#62-representative-column--matching-engine)
   - 6.3 [Runtime Entity Resolution](#63-runtime-entity-resolution)

7. [API Routes](#7-api-routes)
   - 7.1 [Base List Routes](#71-base-list-routes)
   - 7.2 [Table Routes](#72-table-routes)
   - 7.3 [CSV Import Routes](#73-csv-import-routes)

8. [UI Components](#8-ui-components)
   - 8.1 [CreateBaseListDialog](#81-createbaselistdialog)
   - 8.2 [CSVImportWizard](#82-csvimportwizard)
   - 8.3 [CreateTableDialog](#83-createtabledialog)
   - 8.4 [ColumnMappingInterface](#84-columnmappinginterface)

9. [Data Validation & Business Rules](#9-data-validation--business-rules)
   - 9.1 [Base List Validation](#91-base-list-validation)
   - 9.2 [Table Validation](#92-table-validation)
   - 9.3 [CSV Validation](#93-csv-validation)

10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Product Vision & Data Model Philosophy

### 1.1 Separation of Concerns: Lists vs Tables

**Core Principle**: Separate **entity management** (Base Lists) from **data entry** (Tables).
```
┌─────────────────────────────────────────────────────────────┐
│                    CONCEPTUAL MODEL                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BASE LIST (Entity Registry)                                │
│  ┌───────────────────────────────────────────────┐         │
│  │ Name: "Class 10A"                             │         │
│  │ Representative Column: "Student Name"         │         │
│  │                                               │         │
│  │ Entities:                                     │         │
│  │ • Alice Johnson                               │         │
│  │ • Bob Smith                                   │         │
│  │ • Charlie Brown                               │         │
│  │ • Diana Prince                                │         │
│  └───────────────────────────────────────────────┘         │
│                      │                                      │
│                      │ Used by (1:N)                        │
│                      ▼                                      │
│  ┌───────────────────────────────────────────────┐         │
│  │ TABLE: "Math Exam Q1"                         │         │
│  │ Based on: "Class 10A"                         │         │
│  │                                               │         │
│  │ Columns:                                      │         │
│  │ • Student Name (from Base List)               │         │
│  │ • Score (0-100)                               │         │
│  │ • Notes (text)                                │         │
│  │                                               │         │
│  │ Data:                                         │         │
│  │ Alice Johnson  | 92 | Excellent               │         │
│  │ Bob Smith      | 78 | Good effort             │         │
│  └───────────────────────────────────────────────┘         │
│                                                             │
│  ┌───────────────────────────────────────────────┐         │
│  │ TABLE: "Math Exam Q2"                         │         │
│  │ Based on: "Class 10A"                         │         │
│  │                                               │         │
│  │ Columns:                                      │         │
│  │ • Student Name (same Base List)               │         │
│  │ • Score (0-100)                               │         │
│  │ • Completion Date                             │         │
│  │                                               │         │
│  │ Data:                                         │         │
│  │ Alice Johnson  | 88 | 2025-03-15              │         │
│  │ Charlie Brown  | 91 | 2025-03-15              │         │
│  └───────────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why This Approach?**

1. **DRY Principle**: Student roster exists once, used by many tables
2. **Data Integrity**: Update "Alice Johnson" → "Alice Johnson-Smith" in one place
3. **Voice Matching**: Representative Column provides consistent entity vocabulary
4. **Reusability**: Same Base List for Math, Science, English exams
5. **Flexibility**: Also support standalone tables (created from scratch)

**User Mental Model:**
```
Base List = "The People/Things I'm Tracking"
Table = "The Data I'm Collecting About Them"
```

### 1.2 Representative Column Concept

**Definition**: The primary identifier column that the Voice Matching Engine uses to resolve entities.
```typescript
interface BaseList {
  id: string;
  name: string;
  descriptions?: string;
  entities: ListEntity[];       // The actual rows
}

interface Table {
  id: string;
  name: string;
  base_list_id?: string | null;
  representativeColumn: string;  // ← Defined at TABLE level, not BaseList
  schema: TableSchema;
}

// Example: Same BaseList, different Tables with different representative columns
const classList: BaseList = {
  id: 'list-123',
  name: 'Class 10A',
  schema: {
    columns: [
      { id: 'first_name', label: 'First Name', type: 'text' },
      { id: 'student_id', label: 'Student ID', type: 'text' },
      { id: 'email', label: 'Email', type: 'text' },
    ],
  },
  entities: [
    { 
      id: 'e1', 
      values: { 
        'first_name': 'Alice Johnson', 
        'student_id': '001',
        'email': 'alice@school.edu'
      } 
    },
    { 
      id: 'e2', 
      values: { 
        'first_name': 'Bob Smith', 
        'student_id': '002',
        'email': 'bob@school.edu'
      } 
    },
  ],
};

// Table 1: Casual grading (uses first names)
const mathExamTable: Table = {
  id: 'table-1',
  name: 'Math Exam Q1',
  base_list_id: 'list-123',
  representativeColumn: 'first_name',  // ← Teacher says "Alice, 92"
  schema: { /* ... */ },
};

// Table 2: Official records (uses student IDs)
const officialGradesTable: Table = {
  id: 'table-2',
  name: 'Official Final Grades',
  base_list_id: 'list-123',
  representativeColumn: 'student_id',  // ← Teacher says "001, 92"
  schema: { /* ... */ },
};

// Table 3: Email notifications (uses email addresses)
const emailListTable: Table = {
  id: 'table-3',
  name: 'Parent Email List',
  base_list_id: 'list-123',
  representativeColumn: 'email',  // ← Match by email address
  schema: { /* ... */ },
};
```

**Rules:**
- Every Table MUST have exactly one Representative Column
- Representative Column MUST be type `text`
- Representative Column values MUST be unique within the BaseList entities (enforced at BaseList creation)
- If Table is from a BaseList, Representative Column MUST reference a BaseList column
- If Table is from scratch, Representative Column MUST reference the entity identifier column defined inline
- Representative Column feeds the Matching Engine (see Section 6)

**Use Cases:**

| Base List Type | Possible Representative Columns | Use Case Examples |
|----------------|--------------------------------|-------------------|
| Student Roster | • Student Name (casual)<br>• Student ID (official)<br>• Email (contact lists) | Exam grading vs. official transcripts vs. email campaigns |
| Product Inventory | • Product Name (friendly)<br>• SKU (warehouse)<br>• Barcode (POS) | Sales entry vs. inventory audit vs. checkout scanning |
| Employee Directory | • Full Name (HR)<br>• Employee ID (payroll)<br>• Badge Number (security) | Performance reviews vs. payroll processing vs. access logs |
| Customer List | • Customer Name (service)<br>• Customer ID (CRM)<br>• Phone Number (support) | Sales calls vs. account management vs. phone support |

**Why This Design?**
```
┌─────────────────────────────────────────────────────────────┐
│ FLEXIBILITY: One BaseList, Multiple Use Cases               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BaseList: "Class 10A"                                      │
│  ┌───────────────────────────────────────────┐             │
│  │ Columns:                                  │             │
│  │ • first_name: "Alice Johnson"             │             │
│  │ • student_id: "001"                       │             │
│  │ • email: "alice@school.edu"               │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│              ↓           ↓           ↓                      │
│                                                             │
│  Table A         Table B         Table C                   │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                │
│  │ Math    │    │ Official│    │ Email   │                │
│  │ Exam    │    │ Grades  │    │ List    │                │
│  │         │    │         │    │         │                │
│  │ Rep col:│    │ Rep col:│    │ Rep col:│                │
│  │ "first_ │    │ "student│    │ "email" │                │
│  │ name"   │    │ _id"    │    │         │                │
│  └─────────┘    └─────────┘    └─────────┘                │
│                                                             │
│  Voice:          Voice:          Voice:                    │
│  "Alice, 92"     "001, 92"       "alice@..."               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

```


### 1.3 Creation Methods

**Method 1: Interactive UI**
- Manual form with dynamic row addition
- Inline editing
- Immediate validation
- Best for: Small lists (< 50 entities)

**Method 2: CSV Import**
- Upload CSV file
- Column mapping interface
- Bulk validation
- Representative Column selection
- Best for: Large lists (50+ entities), ERP integration

**Method 3: Table from Scratch**
- Skip Base List entirely
- Define schema inline
- Voice matching on inline entities
- Best for: One-off tables, ad-hoc data entry

---

## 2. Conceptual Data Model

### 2.1 Entity Relationship Diagram
```
┌────────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐                                         │
│  │   users      │                                         │
│  ├──────────────┤                                         │
│  │ id (PK)      │                                         │
│  │ email        │                                         │
│  │ created_at   │                                         │
│  └──────┬───────┘                                         │
│         │                                                 │
│         │ 1:N                                             │
│         ▼                                                 │
│  ┌──────────────────────────────────┐                    │
│  │   base_lists                     │                    │
│  ├──────────────────────────────────┤                    │
│  │ id (PK)                          │                    │
│  │ user_id (FK → users)             │                    │
│  │ name                             │                    │
│  │ description                      │                    │
│  │ schema (JSONB)                   │◄─── Column defs    │
│  │ created_at                       │     (no rep col)   │
│  │ updated_at                       │                    │
│  └──────┬───────────────────────────┘                    │
│         │                                                 │
│         │ 1:N                                             │
│         ▼                                                 │
│  ┌──────────────────────────────────┐                    │
│  │   list_entities                  │                    │
│  ├──────────────────────────────────┤                    │
│  │ id (PK)                          │                    │
│  │ base_list_id (FK → base_lists)   │                    │
│  │ values (JSONB)                   │◄─── { "first_...  │
│  │ created_at                       │                    │
│  │ updated_at                       │                    │
│  └──────────────────────────────────┘                    │
│                                                            │
│         ┌────────────────────────────┐                    │
│         │ 1:N                        │                    │
│         ▼                            │                    │
│  ┌──────────────────────────────────┐│                   │
│  │   tables                         ││                   │
│  ├──────────────────────────────────┤│                   │
│  │ id (PK)                          ││                   │
│  │ user_id (FK → users)             ││                   │
│  │ base_list_id (FK, nullable)      │├───► NULL if from  │
│  │ representative_column (text)     │├───► "first_name"  │
│  │ name                             ││     or "student_id"│
│  │ description                      ││                   │
│  │ schema (JSONB)                   ││                   │
│  │ settings (JSONB)                 ││                   │
│  │ created_at                       ││                   │
│  │ updated_at                       ││                   │
│  └──────┬───────────────────────────┘│                   │
│         │                            │                    │
│         │ 1:N                        │                    │
│         ▼                            │                    │
│  ┌──────────────────────────────────┐│                   │
│  │   table_data                     ││                   │
│  ├──────────────────────────────────┤│                   │
│  │ id (PK)                          ││                   │
│  │ table_id (FK → tables)           ││                   │
│  │ entity_id (FK → list_entities)   │├───► NULL if from  │
│  │ row_id (text)                    ││     scratch       │
│  │ column_id (text)                 ││                   │
│  │ value (JSONB)                    ││                   │
│  │ created_at                       ││                   │
│  │ updated_at                       ││                   │
│  │ UNIQUE(table_id, row_id, col_id) ││                   │
│  └──────────────────────────────────┘│                   │
│                                                            │
└────────────────────────────────────────────────────────────┘

KEY CHANGE: representative_column moved from base_lists → tables

```

### 2.2 Database Schema (Supabase/PostgreSQL)
```sql
-- ═══════════════════════════════════════════════════════════
-- BASE LISTS TABLE (UPDATED - NO REPRESENTATIVE COLUMN)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS base_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Schema definition (just column metadata, no designation of "representative")
  -- Format: { columns: [{ id, label, type, validation? }] }
  schema JSONB NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT base_lists_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT base_lists_schema_is_object CHECK (jsonb_typeof(schema) = 'object')
);

-- Indexes
CREATE INDEX idx_base_lists_user_id ON base_lists(user_id);
CREATE INDEX idx_base_lists_name ON base_lists(user_id, name);

-- Auto-update updated_at
CREATE TRIGGER update_base_lists_updated_at
  BEFORE UPDATE ON base_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- LIST ENTITIES TABLE (UNCHANGED)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS list_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_list_id UUID NOT NULL REFERENCES base_lists(id) ON DELETE CASCADE,
  
  -- Entity values as key-value pairs
  -- Format: { "first_name": "Alice", "last_name": "Johnson", "student_id": "001" }
  values JSONB NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT list_entities_values_is_object CHECK (jsonb_typeof(values) = 'object')
);

-- Indexes
CREATE INDEX idx_list_entities_base_list_id ON list_entities(base_list_id);

-- GIN index for JSONB queries (find entities by value)
CREATE INDEX idx_list_entities_values ON list_entities USING GIN (values);

-- Auto-update updated_at
CREATE TRIGGER update_list_entities_updated_at
  BEFORE UPDATE ON list_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- TABLES TABLE (UPDATED - ADDED REPRESENTATIVE_COLUMN)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- NULLABLE: If NULL, table was created from scratch
  base_list_id UUID REFERENCES base_lists(id) ON DELETE SET NULL,
  
  -- NEW: Representative column for voice matching
  -- References a column ID from the table's schema
  -- If table is from a BaseList, this must reference a BaseList column
  -- If table is from scratch, this references the entity identifier column
  representative_column TEXT NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Schema definition (columns only, rows come from base_list_id OR inline)
  -- Format: { columns: [{ id, label, type, validation?, metadata? }], rows?: [...] }
  schema JSONB NOT NULL,
  
  -- UI/Voice settings
  settings JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT tables_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT tables_rep_col_not_empty CHECK (length(trim(representative_column)) > 0),
  CONSTRAINT tables_schema_is_object CHECK (jsonb_typeof(schema) = 'object')
);

-- Indexes
CREATE INDEX idx_tables_user_id ON tables(user_id);
CREATE INDEX idx_tables_base_list_id ON tables(base_list_id);
CREATE INDEX idx_tables_name ON tables(user_id, name);
CREATE INDEX idx_tables_rep_col ON tables(representative_column);

-- Auto-update updated_at
CREATE TRIGGER update_tables_updated_at
  BEFORE UPDATE ON tables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- TABLE DATA TABLE (UNCHANGED)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS table_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  
  -- NULLABLE: If NULL, row was created inline (not from base_list)
  entity_id UUID REFERENCES list_entities(id) ON DELETE CASCADE,
  
  -- Row identifier (either entity_id or inline identifier)
  row_id TEXT NOT NULL,
  
  -- Column identifier
  column_id TEXT NOT NULL,
  
  -- Cell value
  value JSONB NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint per cell
  UNIQUE(table_id, row_id, column_id),
  
  CONSTRAINT table_data_row_id_not_empty CHECK (length(trim(row_id)) > 0),
  CONSTRAINT table_data_column_id_not_empty CHECK (length(trim(column_id)) > 0),
  CONSTRAINT table_data_value_is_object CHECK (jsonb_typeof(value) = 'object')
);

-- Indexes
CREATE INDEX idx_table_data_table_id ON table_data(table_id);
CREATE INDEX idx_table_data_entity_id ON table_data(entity_id);
CREATE INDEX idx_table_data_row_id ON table_data(table_id, row_id);
CREATE INDEX idx_table_data_column_id ON table_data(table_id, column_id);

-- Auto-update updated_at
CREATE TRIGGER update_table_data_updated_at
  BEFORE UPDATE ON table_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (UNCHANGED)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE base_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_entities ENABLE ROW LEVEL SECURITY;
-- tables and table_data already have RLS from previous spec

-- Base Lists RLS
CREATE POLICY "Users can view own base lists"
  ON base_lists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own base lists"
  ON base_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own base lists"
  ON base_lists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own base lists"
  ON base_lists FOR DELETE
  USING (auth.uid() = user_id);

-- List Entities RLS
CREATE POLICY "Users can view entities from own lists"
  ON list_entities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM base_lists
      WHERE base_lists.id = list_entities.base_list_id
        AND base_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create entities in own lists"
  ON list_entities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM base_lists
      WHERE base_lists.id = list_entities.base_list_id
        AND base_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update entities in own lists"
  ON list_entities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM base_lists
      WHERE base_lists.id = list_entities.base_list_id
        AND base_lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM base_lists
      WHERE base_lists.id = list_entities.base_list_id
        AND base_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete entities from own lists"
  ON list_entities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM base_lists
      WHERE base_lists.id = list_entities.base_list_id
        AND base_lists.user_id = auth.uid()
    )
  );
```

### 2.3 TypeScript Interfaces
```typescript
// types/product-data.ts

// ═══════════════════════════════════════════════════════════
// BASE LIST TYPES (UPDATED - NO REPRESENTATIVE COLUMN)
// ═══════════════════════════════════════════════════════════

export interface BaseListColumn {
  id: string;                    // "first_name", "student_id"
  label: string;                 // "First Name", "Student ID"
  type: 'text' | 'number' | 'date' | 'boolean';
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface BaseListSchema {
  columns: BaseListColumn[];
}

export interface BaseList {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  // REMOVED: representative_column (now lives in Table)
  schema: BaseListSchema;
  created_at: string;
  updated_at: string;
}

export interface ListEntity {
  id: string;
  base_list_id: string;
  values: Record<string, any>;    // { "first_name": "Alice", "student_id": "001", ... }
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════
// TABLE TYPES (UPDATED - ADDED REPRESENTATIVE_COLUMN)
// ═══════════════════════════════════════════════════════════

export interface TableColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
  metadata?: {
    source?: 'base_list' | 'user_defined';
    base_list_column_id?: string;  // If from base list
  };
}

export interface TableRow {
  id: string;
  label: string;
  metadata?: {
    source?: 'base_list' | 'inline';
    entity_id?: string;  // If from base list
  };
}

export interface TableSchema {
  columns: TableColumn[];
  rows: TableRow[];
}

export interface Table {
  id: string;
  user_id: string;
  base_list_id?: string | null;  // NULL if created from scratch
  
  // NEW: Representative column (the column used for voice matching)
  // This references a column ID from the table's schema
  // Example: "first_name" or "student_id"
  representative_column: string;
  
  name: string;
  description?: string;
  schema: TableSchema;
  settings: {
    voice?: {
      defaultMode?: 'column-first' | 'row-first';
      autoAdvanceDelay?: number;
      confirmationThreshold?: number;
    };
    display?: {
      theme?: 'light' | 'dark';
      fontSize?: 'small' | 'medium' | 'large';
    };
  };
  created_at: string;
  updated_at: string;
}

export interface TableData {
  id: string;
  table_id: string;
  entity_id?: string | null;  // NULL if inline row
  row_id: string;
  column_id: string;
  value: { v: any };
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════
// CSV IMPORT TYPES (UNCHANGED)
// ═══════════════════════════════════════════════════════════

export interface CSVColumn {
  index: number;
  name: string;
  preview: string[];  // First 5 values
  detectedType: 'text' | 'number' | 'date' | 'boolean';
}

export interface CSVMapping {
  csvColumn: string;
  targetColumn: {
    id: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'boolean';
  };
}

export interface CSVImportConfig {
  file: File;
  hasHeaders: boolean;
  delimiter: ',' | ';' | '\t';
  columns: CSVColumn[];
  mappings: CSVMapping[];
  // REMOVED: representativeColumnIndex (selected when creating Table)
  createAsBaseList: boolean;
  baseListName?: string;
}

// ═══════════════════════════════════════════════════════════
// API REQUEST/RESPONSE TYPES (UPDATED)
// ═══════════════════════════════════════════════════════════

export interface CreateBaseListRequest {
  name: string;
  description?: string;
  // REMOVED: representative_column
  schema: BaseListSchema;
  entities: Array<Record<string, any>>;
}

export interface CreateTableRequest {
  name: string;
  description?: string;
  base_list_id?: string;  // Optional: NULL for from-scratch tables
  representative_column: string;  // NEW: Required for all tables
  schema: TableSchema;
}

export interface ImportCSVRequest {
  name: string;
  description?: string;
  mappings: CSVMapping[];
  // REMOVED: representativeColumnIndex
  data: Array<Record<string, any>>;
}

---

## 3. User Journey: Creating a Base List

### 3.1 Method 1: Interactive UI Creation

**User Flow:**
```
1. User clicks "Create Base List" button
2. Modal opens: "New Base List"
3. User enters:
   - Name: "Class 10A"
   - Description: "Math class, Spring 2025"
4. User clicks "Add Column"
   - Column 1: "Student Name" (type: text, required)
   - Column 2: "Student ID" (type: text)
   - Column 3: "Email" (type: text)
5. User selects Representative Column: "Student Name" ⭐
6. User clicks "Next: Add Entities"
7. Dynamic table appears:
   ┌─────────────────┬────────────┬─────────────────────┐
   │ Student Name    │ Student ID │ Email               │
   ├─────────────────┼────────────┼─────────────────────┤
   │ [Empty]         │ [Empty]    │ [Empty]             │
   └─────────────────┴────────────┴─────────────────────┘
8. User fills first row:
   - Student Name: "Alice Johnson"
   - Student ID: "001"
   - Email: "alice@school.edu"
9. User clicks "+ Add Row" (appears below)
10. User fills more rows...
11. User clicks "Create List" (button)
12. Success! Redirected to Base List detail page
```

**Component Breakdown:**
```typescript
// components/CreateBaseListDialog.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Star } from 'lucide-react';
import { BaseListColumn, ListEntity } from '@/types/product-data';

export function CreateBaseListDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'info' | 'columns' | 'entities'>('info');
  
  // Step 1: Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Step 2: Columns
  const [columns, setColumns] = useState<BaseListColumn[]>([
    {
      id: 'col_1',
      label: '',
      type: 'text',
      validation: { required: true },
    },
  ]);
  const [representativeColumn, setRepresentativeColumn] = useState<string>('');
  
  // Step 3: Entities
  const [entities, setEntities] = useState<Array<Record<string, any>>>([{}]);
  
  const handleAddColumn = () => {
    setColumns([
      ...columns,
      {
        id: `col_${Date.now()}`,
        label: '',
        type: 'text',
      },
    ]);
  };
  
  const handleRemoveColumn = (index: number) => {
    const newColumns = columns.filter((_, i) => i !== index);
    setColumns(newColumns);
    
    // Reset representative column if it was deleted
    if (representativeColumn === columns[index].id) {
      setRepresentativeColumn('');
    }
  };
  
  const handleAddEntity = () => {
    setEntities([...entities, {}]);
  };
  
  const handleUpdateEntity = (
    entityIndex: number,
    columnId: string,
    value: any
  ) => {
    const newEntities = [...entities];
    newEntities[entityIndex][columnId] = value;
    setEntities(newEntities);
  };
  
  const handleSubmit = async () => {
    // Validate
    if (!name || !representativeColumn || entities.length === 0) {
      alert('Please fill all required fields');
      return;
    }
    
    // Create base list
    const response = await fetch('/api/base-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        representative_column: representativeColumn,
        schema: { columns },
        entities,
      }),
    });
    
    if (response.ok) {
      onClose();
      // Redirect or refresh
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Base List</DialogTitle>
        </DialogHeader>
        
        {step === 'info' && (
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Class 10A"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            
            <Button onClick={() => setStep('columns')}>
              Next: Define Columns
            </Button>
          </div>
        )}
        
        {step === 'columns' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {columns.map((column, index) => (
                <div key={column.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Column Name</Label>
                    <Input
                      value={column.label}
                      onChange={(e) => {
                        const newColumns = [...columns];
                        newColumns[index].label = e.target.value;
                        newColumns[index].id = e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '_');
                        setColumns(newColumns);
                      }}
                      placeholder="e.g., Student Name"
                    />
                  </div>
                  
                  <div className="w-32">
                    <Label>Type</Label>
                    <select
                      value={column.type}
                      onChange={(e) => {
                        const newColumns = [...columns];
                        newColumns[index].type = e.target.value as any;
                        setColumns(newColumns);
                      }}
                      className="w-full border rounded px-2 py-1"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                  
                  <Button
                    variant={
                      representativeColumn === column.id ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setRepresentativeColumn(column.id)}
                    title="Set as Representative Column"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        representativeColumn === column.id ? 'fill-yellow-400' : ''
                      }`}
                    />
                  </Button>
                  
                  {columns.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveColumn(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            <Button variant="outline" onClick={handleAddColumn}>
              <Plus className="h-4 w-4 mr-2" />
              Add Column
            </Button>
            
            {representativeColumn && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                ⭐ Representative Column:{' '}
                <strong>
                  {columns.find((c) => c.id === representativeColumn)?.label}
                </strong>
                <p className="text-gray-600 mt-1">
                  This will be used for voice matching
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('info')}>
                Back
              </Button>
              <Button
                onClick={() => setStep('entities')}
                disabled={!representativeColumn}
              >
                Next: Add Entities
              </Button>
            </div>
          </div>
        )}
        
        {step === 'entities' && (
          <div className="space-y-4">
            <div className="border rounded overflow-x-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.id}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-700"
                      >
                        {column.label}
                        {column.id === representativeColumn && (
                          <Star className="inline h-3 w-3 ml-1 fill-yellow-400" />
                        )}
                      </th>
                    ))}
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((entity, entityIndex) => (
                    <tr key={entityIndex} className="border-t">
                      {columns.map((column) => (
                        <td key={column.id} className="px-4 py-2">
                          <Input
                            value={entity[column.id] || ''}
                            onChange={(e) =>
                              handleUpdateEntity(
                                entityIndex,
                                column.id,
                                e.target.value
                              )
                            }
                            placeholder={`Enter ${column.label}`}
                            required={column.id === representativeColumn}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2">
                        {entities.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEntities(entities.filter((_, i) => i !== entityIndex));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <Button variant="outline" onClick={handleAddEntity}>
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('columns')}>
                Back
              </Button>
              <Button onClick={handleSubmit}>Create List</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 3.2 Method 2: CSV Import

**User Flow:**
```
1. User clicks "Import CSV" button
2. CSV Import Wizard opens
3. STEP 1: Upload File
   - Drag & drop or file picker
   - File validation (size, type)
4. STEP 2: Configure Import
   - Has headers? [✓] Yes [ ] No
   - Delimiter: [,] Comma [ ] Semicolon [ ] Tab
   - Preview first 5 rows
5. STEP 3: Map Columns
   ┌────────────────────────────────────────────┐
   │ CSV Column    →  Target Column             │
   ├────────────────────────────────────────────┤
   │ Name          →  [Student Name] (text)     │
   │ ID            →  [Student ID] (text)       │
   │ Email         →  [Email] (text)            │
   │ (ignore)      →  [Skip]                    │
   └────────────────────────────────────────────┘
6. STEP 4: Select Representative Column
   - Radio buttons: Which column identifies entities?
     ( ) Student Name  ⭐ SELECTED
     ( ) Student ID
     ( ) Email
7. STEP 5: Review & Import
   - Preview: "25 entities will be imported"
   - List name: "Class 10A" (auto-filled from filename or editable)
   - [Import] button
8. Import executes (progress bar)
9. Success! Redirected to Base List detail
```

**See Section 5 for detailed CSV Import Pipeline implementation.**

### 3.3 Selecting Representative Column

**UI Guidelines:**
```typescript
// components/RepresentativeColumnSelector.tsx

'use client';

import { Star } from 'lucide-react';
import { BaseListColumn } from '@/types/product-data';

export function RepresentativeColumnSelector({
  columns,
  selected,
  onSelect,
}: {
  columns: BaseListColumn[];
  selected: string;
  onSelect: (columnId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        Representative Column *
      </Label>
      <p className="text-sm text-gray-600">
        This column will be used to identify entities during voice input.
        Choose a column with unique, recognizable values.
      </p>
      
      <div className="space-y-2 mt-4">
        {columns.map((column) => (
          <div
            key={column.id}
            onClick={() => onSelect(column.id)}
            className={`
              flex items-center gap-3 p-3 border rounded cursor-pointer
              transition-all
              ${
                selected === column.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <div
              className={`
                flex items-center justify-center w-6 h-6 rounded-full border-2
                ${
                  selected === column.id
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }
              `}
            >
              {selected === column.id && (
                <Star className="h-4 w-4 text-white fill-white" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="font-medium">{column.label}</div>
              <div className="text-xs text-gray-500">
                Type: {column.type}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Validation Rules:**
```typescript
// lib/validation/base-list-validation.ts

export function validateRepresentativeColumn(
  column: BaseListColumn,
  entities: Array<Record<string, any>>
): { valid: boolean; error?: string } {
  // Must be text type
  if (column.type !== 'text') {
    return {
      valid: false,
      error: 'Representative column must be of type "text"',
    };
  }
  
  // Must be required
  if (!column.validation?.required) {
    return {
      valid: false,
      error: 'Representative column must be required',
    };
  }
  
  // Must have unique values
  const values = entities.map((e) => e[column.id]);
  const uniqueValues = new Set(values);
  
  if (uniqueValues.size !== values.length) {
    return {
      valid: false,
      error: 'Representative column must have unique values for all entities',
    };
  }
  
  // Must not have empty values
  if (values.some((v) => !v || v.trim() === '')) {
    return {
      valid: false,
      error: 'Representative column cannot have empty values',
    };
  }
  
  return { valid: true };
}
```

---

## 4. User Journey: Creating a Table

### 4.1 Method 1: Table from Base List

**User Flow:**
```
1. User navigates to Base Lists page
2. User sees list of Base Lists:
   ┌────────────────────────────────────────────┐
   │ Class 10A                                  │
   │ 30 students · Last updated 2 days ago      │
   │ [View] [Create Table] [Edit] [Delete]     │
   └────────────────────────────────────────────┘
3. User clicks "Create Table" button
4. Modal opens: "New Table from Class 10A"
5. User enters:
   - Name: "Math Exam Q1"
   - Description: "First quarter math exam"
6. User sees inherited column:
   ✓ Student Name (from Base List) [cannot remove]
7. User clicks "Add Data Column"
   - Column 1: "Score" (type: number, min: 0, max: 100)
   - Column 2: "Notes" (type: text)
8. User clicks "Create Table"
9. Table is created with:
   - Rows: All 30 entities from "Class 10A"
   - Columns: Student Name + Score + Notes
10. User is redirected to Table view (voice input ready)
```

**Component:**
```typescript
// components/CreateTableFromListDialog.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Lock } from 'lucide-react';
import { BaseList, TableColumn } from '@/types/product-data';

export function CreateTableFromListDialog({
  baseList,
  open,
  onClose,
}: {
  baseList: BaseList;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Representative column is locked (inherited from base list)
  const representativeColumn = baseList.schema.columns.find(
    (c) => c.id === baseList.representative_column
  );
  
  // Additional data columns
  const [dataColumns, setDataColumns] = useState<TableColumn[]>([]);
  
  const handleAddColumn = () => {
    setDataColumns([
      ...dataColumns,
      {
        id: `col_${Date.now()}`,
        label: '',
        type: 'text',
      },
    ]);
  };
  
  const handleSubmit = async () => {
    // Build schema
    const schema = {
      columns: [
        {
          id: representativeColumn!.id,
          label: representativeColumn!.label,
          type: representativeColumn!.type,
          metadata: {
            source: 'base_list' as const,
            base_list_column_id: representativeColumn!.id,
          },
        },
        ...dataColumns.map((c) => ({
          ...c,
          metadata: { source: 'user_defined' as const },
        })),
      ],
      rows: [], // Will be populated from base_list_id
    };
    
    // Create table
    const response = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        base_list_id: baseList.id,
        schema,
      }),
    });
    
    if (response.ok) {
      const { data } = await response.json();
      // Redirect to table
      window.location.href = `/table/${data.id}`;
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Table from {baseList.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Table Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Math Exam Q1"
            />
          </div>
          
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          
          <div>
            <Label>Columns</Label>
            
            {/* Inherited column (locked) */}
            <div className="mt-2 flex items-center gap-2 p-3 bg-gray-50 border rounded">
              <Lock className="h-4 w-4 text-gray-500" />
              <div className="flex-1">
                <div className="font-medium">{representativeColumn?.label}</div>
                <div className="text-xs text-gray-500">
                  From Base List (locked)
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {representativeColumn?.type}
              </div>
            </div>
            
            {/* Data columns */}
            <div className="mt-4 space-y-2">
              {dataColumns.map((column, index) => (
                <div key={column.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      value={column.label}
                      onChange={(e) => {
                        const newColumns = [...dataColumns];
                        newColumns[index].label = e.target.value;
                        newColumns[index].id = e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '_');
                        setDataColumns(newColumns);
                      }}
                      placeholder="Column name"
                    />
                  </div>
                  
                  <div className="w-32">
                    <select
                      value={column.type}
                      onChange={(e) => {
                        const newColumns = [...dataColumns];
                        newColumns[index].type = e.target.value as any;
                        setDataColumns(newColumns);
                      }}
                      className="w-full border rounded px-2 py-1"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDataColumns(dataColumns.filter((_, i) => i !== index));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddColumn}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Data Column
            </Button>
          </div>
          
          <Button onClick={handleSubmit} className="w-full">
            Create Table
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.2 Method 2: Table from Scratch

**User Flow:**
```
1. User clicks "Create Table" (from Tables page)
2. Modal opens: "New Table"
3. User selects creation method:
   ( ) From Base List
   (•) From Scratch
4. User enters:
   - Name: "Product Inventory Count"
   - Description: "Weekly inventory audit"
5. User defines BOTH entity column AND data columns:
   - Column 1: "Product Name" (text, required) ⭐ Representative
   - Column 2: "SKU" (text)
   - Column 3: "Quantity" (number, min: 0)
6. User clicks "Next: Add Rows"
7. User manually adds entities:
   - Product Name: "Widget A", SKU: "SKU-001", Quantity: [empty]
   - Product Name: "Widget B", SKU: "SKU-002", Quantity: [empty]
8. User clicks "Create Table"
9. Table is created (standalone, no base_list_id)
10. Voice input works using "Product Name" as representative column
```

**Key Difference from Base List:**
- Table created with `base_list_id = NULL`
- Rows defined inline in table schema
- Representative column selected manually (not inherited)
```typescript
// components/CreateTableDialog.tsx

export function CreateTableDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'from-list' | 'from-scratch'>('from-list');
  
  // ... similar to CreateBaseListDialog but stores in `tables` table
}
```

### 4.3 Adding Data Columns

**Validation Rules:**
```typescript
// lib/validation/table-validation.ts

export function validateTableSchema(schema: TableSchema): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Must have at least 2 columns (1 entity + 1 data)
  if (schema.columns.length < 2) {
    errors.push('Table must have at least 2 columns');
  }
  
  // Must have exactly one representative column
  const repColumns = schema.columns.filter((c) => 
    c.metadata?.source === 'base_list'
  );
  
  if (repColumns.length === 0) {
    errors.push('Table must have a representative column (entity identifier)');
  }
  
  if (repColumns.length > 1) {
    errors.push('Table can only have one representative column');
  }
  
  // Column IDs must be unique
  const columnIds = schema.columns.map((c) => c.id);
  const uniqueIds = new Set(columnIds);
  if (uniqueIds.size !== columnIds.length) {
    errors.push('Column IDs must be unique');
  }
  
  // Must have at least one row
  if (schema.rows.length === 0) {
    errors.push('Table must have at least one row');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## 5. CSV Import Pipeline

### 5.1 File Upload & Parsing
```typescript
// lib/csv/parser.ts

import Papa from 'papaparse';

export interface ParsedCSV {
  headers: string[];
  rows: Array<Record<string, any>>;
  preview: Array<Record<string, any>>;
}

export async function parseCSV(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as Array<Record<string, any>>;
        const preview = rows.slice(0, 5);
        
        resolve({ headers, rows, preview });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}


// Type detection
export function detectColumnType(
  values: any[]
): 'text' | 'number' | 'date' | 'boolean' {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined);
  
  if (nonEmpty.length === 0) return 'text';
  
  // Check if all values are numbers
  const allNumbers = nonEmpty.every((v) => !isNaN(Number(v)));
  if (allNumbers) return 'number';
  
  // Check if all values are boolean-like
  const booleanValues = ['true', 'false', 'yes', 'no', '1', '0'];
  const allBoolean = nonEmpty.every((v) =>
    booleanValues.includes(String(v).toLowerCase())
  );
  if (allBoolean) return 'boolean';
  
  // Check if all values are date-like
  const allDates = nonEmpty.every((v) => !isNaN(Date.parse(String(v))));
  if (allDates && nonEmpty.length > 0) return 'date';
  
  // Default to text
  return 'text';
}

export function analyzeCSVColumns(
  headers: string[],
  rows: Array<Record<string, any>>
): CSVColumn[] {
  return headers.map((header, index) => {
    const values = rows.map((row) => row[header]);
    const preview = values.slice(0, 5);
    const detectedType = detectColumnType(values);
    
    return {
      index,
      name: header,
      preview: preview.map(String),
      detectedType,
    };
  });
}