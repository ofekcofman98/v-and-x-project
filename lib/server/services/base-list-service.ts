import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/shared/generated/prisma/client";
import { ownershipWhere } from "@/lib/server/services/auth";

type ColumnType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN";

interface EntityField {
  id: string;
  label: string;
  type: ColumnType;
  validation?: Record<string, unknown>;
}

interface CreateBaseListInput {
  userId: string;
  name: string;
  description?: string;
  schema: { columns: EntityField[] };
  entities: Array<{ values: Record<string, string | number | boolean | null> }>;
}

export async function createBaseList(input: CreateBaseListInput) {
  const { userId, name, description, schema, entities } = input;

  return prisma.baseList.create({
    data: {
      name,
      description,
      userId,
      schema: schema as unknown as Prisma.InputJsonValue,
      entities: {
        create: entities.map((e) => ({
          values: e.values as Prisma.InputJsonValue,
        })),
      },
    },
    include: { entities: true },
  });
}

export async function listBaseLists(userId: string, organizationIds: string[]) {
  return prisma.baseList.findMany({
    where: ownershipWhere(userId, organizationIds),
  });
}

export async function getBaseListById(userId: string, organizationIds: string[], id: string) {
  const baseList = await prisma.baseList.findFirst({
    where: { id, ...ownershipWhere(userId, organizationIds) },
    include: { entities: true },
  });

  if (!baseList) throw new Error("BaseList not found");
  return baseList;
}

export async function deleteBaseList(userId: string, organizationIds: string[], id: string) {
  const existing = await prisma.baseList.findFirst({
    where: { id, ...ownershipWhere(userId, organizationIds) },
    select: { id: true },
  });

  if (!existing) throw new Error("BaseList not found");

  await prisma.baseList.delete({ where: { id } });
  return { id };
}

export async function listAppliedTemplates(userId: string, organizationIds: string[], baseListId: string) {
  const baseList = await prisma.baseList.findFirst({
    where: { id: baseListId, ...ownershipWhere(userId, organizationIds) },
    select: { id: true },
  });

  if (!baseList) throw new Error("BaseList not found");

  const applied = await prisma.baseListTemplate.findMany({
    where: { baseListId },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          schema: true,
          isPublic: true,
        },
      },
    },
    orderBy: { appliedAt: "desc" },
  });

  return applied.map((entry) => ({
    id: entry.id,
    template_id: entry.template.id,
    template_name: entry.template.name,
    template_description: entry.template.description,
    template_category: entry.template.category,
    template_schema: entry.template.schema,
    is_public: entry.template.isPublic,
    auto_sync: entry.autoSync,
    applied_at: entry.appliedAt,
  }));
}

const IDENTITY_COLUMN_KEYS = new Set(["name", "id", "identifier", "key"]);

function isIdentityColumn(col: { id: string; label: string }): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  return IDENTITY_COLUMN_KEYS.has(norm(col.id)) || IDENTITY_COLUMN_KEYS.has(norm(col.label));
}

interface ApplyTemplateInput {
  userId: string;
  organizationIds: string[];
  baseListId: string;
  templateId: string;
  autoSync: boolean;
  selectedBaseListColumnIds: string[];
}

export async function applyTemplateToBaseList(input: ApplyTemplateInput) {
  const { userId, organizationIds, baseListId, templateId, autoSync, selectedBaseListColumnIds } = input;

  const [baseList, template] = await Promise.all([
    prisma.baseList.findFirst({
      where: { id: baseListId, ...ownershipWhere(userId, organizationIds) },
      select: { id: true, name: true, schema: true },
    }),
    prisma.columnTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true, schema: true, isPublic: true, userId: true },
    }),
  ]);

  if (!baseList) throw new Error("BaseList not found");
  if (!template) throw new Error("Column template not found");

  // Access check: user must own the template or it must be public
  if (template.userId !== userId && !template.isPublic) {
    throw new Error("Column template not found");
  }

  const templateSchema = template.schema as { columns: Array<{ id: string; label: string; type: string }> };
  const baseListSchema = baseList.schema as { columns: Array<{ id: string; label: string; type: string }> };

  const columnsToKeep = new Set(selectedBaseListColumnIds);

  const filteredBaseListColumns = baseListSchema.columns.filter((col) => {
    if (isIdentityColumn(col)) return true;
    return columnsToKeep.has(col.id);
  });

  const existingColumnIds = new Set(filteredBaseListColumns.map((c) => c.id));
  const uniqueTemplateColumns = templateSchema.columns.filter((col) => !existingColumnIds.has(col.id));

  const newColumns = [...filteredBaseListColumns, ...uniqueTemplateColumns];
  const columnsAdded = templateSchema.columns.length;
  const conflicts: unknown[] = [];

  // The representative column key defaults to the first identity column present
  // in the merged schema, falling back to the very first column's id.
  const representativeColumnKey = newColumns.find(isIdentityColumn)?.id ?? newColumns[0]?.id ?? "name";

  const tableName = `${baseList.name} - ${template.name}`;

  const [newTable] = await prisma.$transaction([
    prisma.table.create({
      data: {
        name: tableName,
        baseListId,
        userId,
        schema: { columns: newColumns } as unknown as Prisma.InputJsonValue,
        representativeColumnKey,
        settings: {} as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.baseListTemplate.upsert({
      where: { baseListId_templateId: { baseListId, templateId } },
      create: { baseListId, templateId, autoSync },
      update: { autoSync, appliedAt: new Date() },
    }),
    prisma.columnTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    }),
  ]);

  return {
    base_list_id: baseListId,
    table_id: newTable.id,
    table_name: newTable.name,
    template_applied: true,
    columns_added: columnsAdded,
    conflicts,
  };
}
