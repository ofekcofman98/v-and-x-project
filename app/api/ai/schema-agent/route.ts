/**
 * Schema Agent API Route
 * HTTP transport layer only — all business logic lives in:
 *   lib/server/services/ai-service/schema-agent.ts
 *
 * Responsibilities of this file:
 *   - Auth the caller and resolve their accessible organization IDs
 *   - Validate the JSON request body with Zod (SchemaAgentRequestSchema)
 *   - Delegate to generateTableDraft
 *   - Wrap the result in the standard { success, data } envelope
 *
 * Based on: docs/features/03_ai_table_agent.md §3.4, docs/11_API_ROUTES.md
 *
 * Note: rate limiting (per docs/features/03_ai_table_agent.md §3.4) is
 * intentionally not implemented here yet — no rate-limiting infrastructure
 * exists in the repo, and an in-memory limiter would not enforce correctly
 * across Vercel serverless instances. Flagged as a follow-up.
 */

import { withErrorHandler, parseBody, apiSuccess, apiError } from "@/lib/shared/utils/api";
import { getAuthenticatedUser, getAccessibleOrganizationIds } from "@/lib/server/services/auth";
import { generateTableDraft } from "@/lib/server/services/ai-service/schema-agent";
import { SchemaAgentRequestSchema } from "@/lib/shared/types/ai";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// POST /api/ai/schema-agent
// Draft a Table + TableColumn[] schema from a natural language prompt.
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await parseBody(req, SchemaAgentRequestSchema);
  if (!body.success) return body.errorResponse;

  const organizationIds = await getAccessibleOrganizationIds(user.id);

  try {
    const result = await generateTableDraft({
      userId: user.id,
      organizationIds,
      prompt: body.data.prompt,
      mentions: body.data.mentions,
    });
    return apiSuccess(result, 200);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return apiError(error.message, 404);
    }
    throw error;
  }
});
