import { prisma } from "@/lib/prisma";
import { Prisma, OrgRole } from "@/lib/shared/generated/prisma/client";
import {
  getAccessibleGroupIds,
  getAccessibleWorkbenchIds,
  workbenchOwnershipWhere,
  GROUP_MAX_DEPTH,
} from "@/lib/server/services/auth";

async function assertGroupAccessible(userId: string, organizationIds: string[], groupId: string) {
  const accessibleGroupIds = await getAccessibleGroupIds(userId, organizationIds);
  if (!accessibleGroupIds.includes(groupId)) throw new Error("Group not found");
  return accessibleGroupIds;
}

async function assertWorkbenchAccessible(userId: string, organizationIds: string[], workbenchId: string) {
  const accessibleWorkbenchIds = await getAccessibleWorkbenchIds(userId);
  const workbench = await prisma.workbench.findFirst({
    where: { id: workbenchId, ...workbenchOwnershipWhere(userId, organizationIds, accessibleWorkbenchIds) },
    select: { id: true },
  });
  if (!workbench) throw new Error("Workbench not found");
}

/** Counts levels from `parentGroupId` up to its root, throwing if that would exceed GROUP_MAX_DEPTH. */
async function assertDepthWithinCap(parentGroupId: string) {
  let depth = 1;
  let currentId: string | null = parentGroupId;

  while (currentId) {
    if (depth > GROUP_MAX_DEPTH) {
      throw new Error(`Group nesting exceeds the maximum depth of ${GROUP_MAX_DEPTH}`);
    }
    const current: { parentGroupId: string | null } | null = await prisma.group.findUnique({
      where: { id: currentId },
      select: { parentGroupId: true },
    });
    if (!current) throw new Error("Parent group not found");
    currentId = current.parentGroupId;
    depth += 1;
  }
}

interface CreateGroupInput {
  userId: string;
  organizationIds: string[];
  workbenchId: string;
  parentGroupId?: string;
  name: string;
  description?: string;
}

export async function createGroup(input: CreateGroupInput) {
  const { userId, organizationIds, workbenchId, parentGroupId, name, description } = input;

  if (parentGroupId) {
    const parent = await prisma.group.findUnique({
      where: { id: parentGroupId },
      select: { id: true, workbenchId: true },
    });
    if (!parent) throw new Error("Parent group not found");
    if (parent.workbenchId !== workbenchId) {
      throw new Error("Parent group does not belong to the given workbench");
    }
    await assertGroupAccessible(userId, organizationIds, parentGroupId);
    await assertDepthWithinCap(parentGroupId);
  } else {
    await assertWorkbenchAccessible(userId, organizationIds, workbenchId);
  }

  return prisma.group.create({
    data: { workbenchId, parentGroupId, name, description },
  });
}

export async function getGroupById(userId: string, organizationIds: string[], id: string) {
  await assertGroupAccessible(userId, organizationIds, id);

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      childGroups: true,
      baseLists: { include: { baseList: true } },
      members: true,
    },
  });

  if (!group) throw new Error("Group not found");
  return group;
}

interface GroupTreeNode {
  id: string;
  name: string;
  description: string | null;
  childGroups: GroupTreeNode[];
  baseLists: Array<{ id: string; name: string }>;
}

async function buildGroupTree(groupId: string, depth: number): Promise<GroupTreeNode> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      childGroups: { select: { id: true } },
      baseLists: { include: { baseList: { select: { id: true, name: true } } } },
    },
  });

  if (!group) throw new Error("Group not found");

  const childGroups =
    depth >= GROUP_MAX_DEPTH
      ? []
      : await Promise.all(group.childGroups.map((child) => buildGroupTree(child.id, depth + 1)));

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    childGroups,
    baseLists: group.baseLists.map((gbl) => gbl.baseList),
  };
}

export async function getGroupTree(userId: string, organizationIds: string[], id: string) {
  await assertGroupAccessible(userId, organizationIds, id);
  return buildGroupTree(id, 0);
}

interface UpdateGroupInput {
  name?: string;
  description?: string;
  settings?: Record<string, unknown>;
  parentGroupId?: string | null;
}

export async function updateGroup(
  userId: string,
  organizationIds: string[],
  id: string,
  updates: UpdateGroupInput
) {
  await assertGroupAccessible(userId, organizationIds, id);

  const current = await prisma.group.findUnique({
    where: { id },
    select: { workbenchId: true },
  });
  if (!current) throw new Error("Group not found");

  if (updates.parentGroupId !== undefined && updates.parentGroupId !== null) {
    const newParent = await prisma.group.findUnique({
      where: { id: updates.parentGroupId },
      select: { id: true, workbenchId: true },
    });
    if (!newParent) throw new Error("Parent group not found");
    if (newParent.workbenchId !== current.workbenchId) {
      throw new Error("Cannot re-parent a group into a different workbench");
    }
    await assertGroupAccessible(userId, organizationIds, updates.parentGroupId);
    await assertDepthWithinCap(updates.parentGroupId);
  }

  return prisma.group.update({
    where: { id },
    data: {
      name: updates.name,
      description: updates.description,
      parentGroupId: updates.parentGroupId,
      settings: updates.settings !== undefined ? (updates.settings as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function deleteGroup(userId: string, organizationIds: string[], id: string) {
  await assertGroupAccessible(userId, organizationIds, id);
  await prisma.group.delete({ where: { id } });
  return { id };
}

export async function addBaseListToGroup(
  userId: string,
  organizationIds: string[],
  groupId: string,
  baseListId: string
) {
  await assertGroupAccessible(userId, organizationIds, groupId);

  return prisma.groupBaseList.upsert({
    where: { groupId_baseListId: { groupId, baseListId } },
    create: { groupId, baseListId },
    update: {},
  });
}

export async function removeBaseListFromGroup(
  userId: string,
  organizationIds: string[],
  groupId: string,
  baseListId: string
) {
  await assertGroupAccessible(userId, organizationIds, groupId);

  const link = await prisma.groupBaseList.findUnique({
    where: { groupId_baseListId: { groupId, baseListId } },
    select: { id: true },
  });
  if (!link) throw new Error("Base list is not in this group");

  await prisma.groupBaseList.delete({ where: { id: link.id } });
  return { groupId, baseListId };
}

export async function addGroupMember(
  userId: string,
  organizationIds: string[],
  groupId: string,
  targetUserId: string,
  role: OrgRole
) {
  await assertGroupAccessible(userId, organizationIds, groupId);

  return prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    create: { groupId, userId: targetUserId, role },
    update: { role },
  });
}

export async function removeGroupMember(
  userId: string,
  organizationIds: string[],
  groupId: string,
  targetUserId: string
) {
  await assertGroupAccessible(userId, organizationIds, groupId);

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    select: { id: true },
  });
  if (!member) throw new Error("Group member not found");

  await prisma.groupMember.delete({ where: { id: member.id } });
  return { groupId, userId: targetUserId };
}
