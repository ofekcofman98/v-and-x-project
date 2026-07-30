import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { LRUCache } from "lru-cache";
import { prisma } from "@/lib/prisma";

/**
 * Request-scoped Supabase client for Server Components/Route Handlers.
 * Reads the session from httpOnly cookies set by middleware.ts.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

// Bounded TTL cache of validated Supabase sessions, keyed by access token.
// supabase.auth.getUser() revalidates against the Auth server on every call
// (needed to catch revoked sessions), which costs a 400-700ms round-trip per
// request. Caching the validated user for a short window keeps that
// revocation check (unlike decoding the JWT locally) while paying the
// network cost at most once per token per TTL window. See docs/10_PERFORMANCE.md §4.5.
const AUTH_USER_CACHE_TTL_MS = 1000 * 45;
const authUserCache = new LRUCache<string, User>({
  max: 500,
  ttl: AUTH_USER_CACHE_TTL_MS,
});

/**
 * Verifies the caller's session server-side and returns the authenticated user.
 * Returns null when there is no valid session — callers must reject with 401.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  // The Supabase SSR cookie can be chunked across multiple cookies
  // (e.g. "sb-<ref>-auth-token.0", ".1", ...) when the session is large,
  // so match on substring and join all parts into one cache key.
  const cookieStore = await cookies();
  const cacheKey = cookieStore
    .getAll()
    .filter((c) => c.name.includes("-auth-token"))
    .map((c) => `${c.name}=${c.value}`)
    .sort()
    .join(";");

  if (cacheKey) {
    const cached = authUserCache.get(cacheKey);
    if (cached) return cached;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && cacheKey) {
    authUserCache.set(cacheKey, user);
  }

  return user;
}

/** Organization IDs the given user is a member of — used to scope org-shared rows. */
export async function getAccessibleOrganizationIds(userId: string): Promise<string[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });

  return memberships.map((m) => m.organizationId);
}

/**
 * Prisma `where` clause fragment scoping a query to rows the user owns
 * directly or via organization membership. Spread into `where: { ... }`.
 */
export function ownershipWhere(userId: string, organizationIds: string[]) {
  return {
    OR: [
      { userId },
      ...(organizationIds.length > 0 ? [{ organizationId: { in: organizationIds } }] : []),
    ],
  };
}

/** Workbench IDs the given user has a direct WorkbenchMember row on. */
export async function getAccessibleWorkbenchIds(userId: string): Promise<string[]> {
  const memberships = await prisma.workbenchMember.findMany({
    where: { userId },
    select: { workbenchId: true },
  });

  return memberships.map((m) => m.workbenchId);
}

/**
 * Prisma `where` clause fragment scoping a Workbench query to rows the user
 * owns, has org access to, or is a direct WorkbenchMember of.
 */
export function workbenchOwnershipWhere(
  userId: string,
  organizationIds: string[],
  accessibleWorkbenchIds: string[]
) {
  return {
    OR: [
      { userId },
      ...(organizationIds.length > 0 ? [{ organizationId: { in: organizationIds } }] : []),
      ...(accessibleWorkbenchIds.length > 0 ? [{ id: { in: accessibleWorkbenchIds } }] : []),
    ],
  };
}

/** Max nesting depth for Groups — a soft cap enforced in code, not the schema. */
export const GROUP_MAX_DEPTH = 5;

/**
 * Group IDs the given user can access: every Group in a Workbench they own,
 * have org access to, or are a WorkbenchMember of, PLUS every Group they (or
 * an ancestor Group) have a direct GroupMember row on, PLUS all descendants
 * of those directly-accessible Groups (access inherits downward from an
 * ancestor membership — see docs/features/12_groups_workbenches.md §4).
 */
export async function getAccessibleGroupIds(userId: string, organizationIds: string[]): Promise<string[]> {
  const accessibleWorkbenchIds = await getAccessibleWorkbenchIds(userId);

  const [workbenchScopedGroups, directGroupMemberships] = await Promise.all([
    prisma.group.findMany({
      where: { workbench: workbenchOwnershipWhere(userId, organizationIds, accessibleWorkbenchIds) },
      select: { id: true },
    }),
    prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    }),
  ]);

  const rootIds = new Set<string>([
    ...workbenchScopedGroups.map((g) => g.id),
    ...directGroupMemberships.map((m) => m.groupId),
  ]);

  // BFS down from the root set to collect inherited descendant access,
  // capped at GROUP_MAX_DEPTH levels to bound the query count.
  const allIds = new Set<string>(rootIds);
  let frontier = Array.from(rootIds);

  for (let depth = 0; depth < GROUP_MAX_DEPTH && frontier.length > 0; depth++) {
    const children = await prisma.group.findMany({
      where: { parentGroupId: { in: frontier } },
      select: { id: true },
    });

    frontier = children.map((c) => c.id).filter((id) => !allIds.has(id));
    frontier.forEach((id) => allIds.add(id));
  }

  return Array.from(allIds);
}
