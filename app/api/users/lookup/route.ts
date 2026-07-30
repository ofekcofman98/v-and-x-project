/**
 * User Lookup Route
 * Resolves an email to a Supabase Auth userId — powers "invite by email"
 * for Workbench/Group members.
 * Implements: docs/features/12_groups_workbenches.md §8 Phase 4
 */

import { z } from "zod";
import { apiError, apiSuccess, withErrorHandler } from "@/lib/shared/utils/api";
import { getAuthenticatedUser } from "@/lib/server/services/auth";
import { findUserByEmail } from "@/lib/server/services/user-lookup";

export const runtime = "nodejs";

const EmailQuerySchema = z.string().email("Invalid email format");

// ─────────────────────────────────────────────────────────
// GET /api/users/lookup?email=...
// ─────────────────────────────────────────────────────────

export const GET = withErrorHandler(async (req) => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const email = new URL(req.url).searchParams.get("email");
  const parsedEmail = EmailQuerySchema.safeParse(email);
  if (!parsedEmail.success) return apiError("Invalid email format", 400);

  const found = await findUserByEmail(parsedEmail.data);
  if (!found) return apiError("No user found with that email", 404);

  return apiSuccess(found);
});
