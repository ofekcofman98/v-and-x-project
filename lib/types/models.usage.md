# Product Data Types - Usage Examples

This document demonstrates how to use the types defined in `lib/types/models.ts`.

## Overview

The type system separates **Base Lists** (entity registries) from **Tables** (data collection instances), following the architecture in `docs/14_PRODUCT_DATA_FLOW.md`.

## Key Concepts

### 1. BaseList (Entity Registry)

A BaseList stores WHO or WHAT you're tracking. It does NOT own the representative column.

```typescript
import type { BaseList, BaseListSchema, ListEntity } from '@/lib/types/models';

// Define the schema (what columns exist)
const schema: BaseListSchema = {
  columns: [
    { id: 'first_name', label: 'First Name', type: ColumnType.TEXT },
    { id: 'student_id', label: 'Student ID', type: ColumnType.TEXT },
    { id: 'email', label: 'Email', type: ColumnType.TEXT },
  ]
};

// The BaseList
const classList: BaseList = {
  id: 'list-123',
  name: 'Class 10A',
  description: 'Homeroom students for 2026',
  schema,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### 2. ListEntity (Rows in a BaseList)

```typescript
const alice: ListEntity = {
  id: 'entity-1',
  baseListId: 'list-123',
  values: {
    first_name: 'Alice Johnson',
    student_id: '001',
    email: 'alice@school.edu',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const bob: ListEntity = {
  id: 'entity-2',
  baseListId: 'list-123',
  values: {
    first_name: 'Bob Smith',
    student_id: '002',
    email: 'bob@school.edu',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### 3. Table (Data Collection Instance)

A Table references a BaseList and defines which column to use for voice matching via `representativeColumnKey`.

#### Example A: Math Exam (matches by first name)

```typescript
import type { Table, TableSchemaJSON } from '@/lib/types/models';

const mathExam: Table = {
  id: 'table-1',
  name: 'Math Exam Q1',
  description: 'First quarter exam scores',
  baseListId: 'list-123', // References "Class 10A"
  
  // Voice Engine will match spoken names against ListEntity.values.first_name
  representativeColumnKey: 'first_name',
  
  schema: {
    columns: [
      {
        id: 'score',
        label: 'Score',
        type: ColumnType.NUMBER,
        validation: { min: 0, max: 100, required: true },
      },
      {
        id: 'notes',
        label: 'Notes',
        type: ColumnType.TEXT,
      },
    ],
  },
  settings: {
    voice: {
      defaultMode: 'row-first',
      confirmationThreshold: 0.8,
    },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

#### Example B: Official Records (matches by student ID)

```typescript
const officialGrades: Table = {
  id: 'table-2',
  name: 'Official Final Grades',
  description: null,
  baseListId: 'list-123', // SAME BaseList
  
  // Voice Engine will match spoken IDs against ListEntity.values.student_id
  representativeColumnKey: 'student_id',
  
  schema: {
    columns: [
      {
        id: 'final_grade',
        label: 'Final Grade',
        type: ColumnType.NUMBER,
        validation: { min: 0, max: 100, required: true },
      },
    ],
  },
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### 4. Voice Engine Conversion

Use `toTableSchema()` to convert our product data model to the format the Voice Engine expects.

```typescript
import { toTableSchema, getEntityVocabulary } from '@/lib/types/models';
import type { TableWithRelations } from '@/lib/types/models';

// Fetch table with all relations
const table: TableWithRelations = await prisma.table.findUnique({
  where: { id: 'table-1' },
  include: {
    columns: { orderBy: { order: 'asc' } },
    baseList: { include: { entities: true } },
  },
});

// Convert to Voice Engine format
const voiceSchema = toTableSchema(table);
/*
{
  columns: [
    { id: 'score', label: 'Score', type: ColumnType.NUMBER, ... },
    { id: 'notes', label: 'Notes', type: ColumnType.TEXT, ... },
  ],
  rows: [
    { id: 'entity-1', label: 'Alice Johnson' },
    { id: 'entity-2', label: 'Bob Smith' },
  ]
}
*/

// Get entity names for matching
const entityNames = getEntityVocabulary(table);
// ["Alice Johnson", "Bob Smith"]
```

## API Route Example

```typescript
// app/api/tables/[tableId]/voice-schema/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toTableSchema } from '@/lib/types/models';

export async function GET(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  const table = await prisma.table.findUnique({
    where: { id: params.tableId },
    include: {
      columns: { orderBy: { order: 'asc' } },
      baseList: { include: { entities: true } },
    },
  });

  if (!table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  const voiceSchema = toTableSchema(table);
  
  return NextResponse.json({
    schema: voiceSchema,
    representativeColumn: table.representativeColumnKey,
  });
}
```

## Creating Data

### Creating a BaseList with Entities

```typescript
import { prisma } from '@/lib/prisma';
import type { BaseListSchema } from '@/lib/types/models';

const schema: BaseListSchema = {
  columns: [
    { id: 'name', label: 'Name', type: ColumnType.TEXT },
    { id: 'employee_id', label: 'Employee ID', type: ColumnType.TEXT },
  ],
};

const baseList = await prisma.baseList.create({
  data: {
    name: 'Engineering Team',
    description: 'Full-time engineers',
    schema: schema as any, // Prisma Json type
  },
});

// Add entities
await prisma.listEntity.createMany({
  data: [
    {
      baseListId: baseList.id,
      values: { name: 'Alice', employee_id: 'ENG001' },
    },
    {
      baseListId: baseList.id,
      values: { name: 'Bob', employee_id: 'ENG002' },
    },
  ],
});
```

### Creating a Table from a BaseList

```typescript
const table = await prisma.table.create({
  data: {
    name: 'Q1 Performance Reviews',
    baseListId: baseList.id,
    representativeColumnKey: 'name', // Match by employee name
    schema: {
      columns: [
        {
          id: 'rating',
          label: 'Rating',
          type: ColumnType.NUMBER,
          validation: { min: 1, max: 5 },
        },
      ],
    } as any,
    settings: {},
  },
});

// Create columns
await prisma.tableColumn.create({
  data: {
    tableId: table.id,
    key: 'rating',
    label: 'Rating',
    type: 'NUMBER',
    order: 0,
    validation: { min: 1, max: 5 },
  },
});
```

### Entering Voice Data

```typescript
// After voice transcription: "Alice, 5"
// Voice Engine extracts: entity="Alice", value=5

// Find the entity by representative column
const entities = await prisma.listEntity.findMany({
  where: {
    baseListId: table.baseListId!,
  },
});

const entity = entities.find(e => e.values['name'] === 'Alice');

if (entity) {
  // Find the column
  const column = await prisma.tableColumn.findFirst({
    where: { tableId: table.id, key: 'rating' },
  });

  // Create or update the cell
  await prisma.tableCell.upsert({
    where: {
      tableId_rowKey_tableColumnId: {
        tableId: table.id,
        rowKey: entity.id,
        tableColumnId: column!.id,
      },
    },
    update: {
      value: { value: 5 },
      entrySource: 'VOICE',
    },
    create: {
      tableId: table.id,
      tableColumnId: column!.id,
      entityId: entity.id,
      rowKey: entity.id,
      value: { value: 5 },
      entrySource: 'VOICE',
    },
  });
}
```

## Type Guards

```typescript
/**
 * Check if a table is backed by a BaseList
 */
export function hasBaseList(table: Table): table is Table & { baseListId: string } {
  return table.baseListId !== null;
}

/**
 * Check if a cell is backed by an entity
 */
export function hasEntity(cell: TableCell): cell is TableCell & { entityId: string } {
  return cell.entityId !== null;
}
```

## Validation Example

```typescript
import { validateRepresentativeColumn } from '@/lib/types/models';

// Ensure representativeColumnKey is valid before saving
const table = { /* ... */ };
const baseList = await prisma.baseList.findUnique({
  where: { id: table.baseListId! },
});

if (!validateRepresentativeColumn(table, baseList.schema)) {
  throw new Error(
    `Invalid representativeColumnKey: "${table.representativeColumnKey}" not found in BaseList schema`
  );
}
```

## Migration Path

When you run the migration, update any code that imports from `@/lib/generated/prisma`:

```typescript
// Before migration:
import type { PrismaColumnType, PrismaEntrySource } from '@/lib/types/models';

// After migration (once Prisma Client is generated):
import type { ColumnType, EntrySource } from '@/lib/generated/prisma';
```

The helper functions (`toTableSchema`, `getEntityVocabulary`, etc.) will continue to work seamlessly.
