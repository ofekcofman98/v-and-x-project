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
