import { prisma } from "@/lib/prisma";

interface AuthUserRow {
  id: string;
  email: string;
}

/**
 * Resolves a Supabase Auth user by email via a direct read against `auth.users`.
 * This app's Prisma connection talks straight to Postgres (not through Supabase's
 * RLS-enforcing REST layer), so this needs no service-role key/Admin API — just
 * the existing DB credentials, read-only, id+email only.
 */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const rows = await prisma.$queryRaw<AuthUserRow[]>`
    SELECT id, email FROM auth.users WHERE email = ${email} LIMIT 1
  `;

  return rows[0] ?? null;
}
