import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
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

/**
 * Verifies the caller's session server-side and returns the authenticated user.
 * Returns null when there is no valid session — callers must reject with 401.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
