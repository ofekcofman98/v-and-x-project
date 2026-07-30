import { prisma } from "@/lib/prisma";
import { Prisma, OrgRole } from "@/lib/shared/generated/prisma/client";
import { workbenchOwnershipWhere, getAccessibleWorkbenchIds } from "@/lib/server/services/auth";

interface CreateWorkbenchInput {
  userId: string;
  name: string;
  description?: string;
  organizationId?: string;
}

export async function createWorkbench(input: CreateWorkbenchInput) {
  const { userId, name, description, organizationId } = input;

  return prisma.workbench.create({
    data: { userId, name, description, organizationId },
  });
}

export async function listWorkbenches(userId: string, organizationIds: string[]) {
  const accessibleWorkbenchIds = await getAccessibleWorkbenchIds(userId);

  return prisma.workbench.findMany({
    where: workbenchOwnershipWhere(userId, organizationIds, accessibleWorkbenchIds),
  });
}

export async function getWorkbenchById(userId: string, organizationIds: string[], id: string) {
  const accessibleWorkbenchIds = await getAccessibleWorkbenchIds(userId);

  const workbench = await prisma.workbench.findFirst({
    where: { id, ...workbenchOwnershipWhere(userId, organizationIds, accessibleWorkbenchIds) },
    include: {
      groups: { where: { parentGroupId: null } },
      members: true,
    },
  });

  if (!workbench) throw new Error("Workbench not found");

  return workbench;
}

interface UpdateWorkbenchInput {
  name?: string;
  description?: string;
  settings?: Record<string, unknown>;
}

export async function updateWorkbench(
  userId: string,
  organizationIds: string[],
  id: string,
  updates: UpdateWorkbenchInput
) {
  const accessibleWorkbenchIds = await getAccessibleWorkbenchIds(userId);

  const existing = await prisma.workbench.findFirst({
    where: { id, ...workbenchOwnershipWhere(userId, organizationIds, accessibleWorkbenchIds) },
    select: { id: true },
  });

  if (!existing) throw new Error("Workbench not found");

  return prisma.workbench.update({
    where: { id },
    data: {
      ...updates,
      settings: updates.settings !== undefined ? (updates.settings as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function deleteWorkbench(userId: string, organizationIds: string[], id: string) {
  const accessibleWorkbenchIds = await getAccessibleWorkbenchIds(userId);

  const existing = await prisma.workbench.findFirst({
    where: { id, ...workbenchOwnershipWhere(userId, organizationIds, accessibleWorkbenchIds) },
    select: { id: true },
  });

  if (!existing) throw new Error("Workbench not found");

  await prisma.workbench.delete({ where: { id } });
  return { id };
}

export async function addWorkbenchMember(
  userId: string,
  organizationIds: string[],
  workbenchId: string,
  targetUserId: string,
  role: OrgRole
) {
  const accessibleWorkbenchIds = await getAccessibleWorkbenchIds(userId);

  const existing = await prisma.workbench.findFirst({
    where: { id: workbenchId, ...workbenchOwnershipWhere(userId, organizationIds, accessibleWorkbenchIds) },
    select: { id: true },
  });

  if (!existing) throw new Error("Workbench not found");

  return prisma.workbenchMember.upsert({
    where: { workbenchId_userId: { workbenchId, userId: targetUserId } },
    create: { workbenchId, userId: targetUserId, role },
    update: { role },
  });
}

export async function removeWorkbenchMember(
  userId: string,
  organizationIds: string[],
  workbenchId: string,
  targetUserId: string
) {
  const accessibleWorkbenchIds = await getAccessibleWorkbenchIds(userId);

  const existing = await prisma.workbench.findFirst({
    where: { id: workbenchId, ...workbenchOwnershipWhere(userId, organizationIds, accessibleWorkbenchIds) },
    select: { id: true },
  });

  if (!existing) throw new Error("Workbench not found");

  const member = await prisma.workbenchMember.findUnique({
    where: { workbenchId_userId: { workbenchId, userId: targetUserId } },
    select: { id: true },
  });

  if (!member) throw new Error("Workbench member not found");

  await prisma.workbenchMember.delete({ where: { id: member.id } });
  return { workbenchId, userId: targetUserId };
}
