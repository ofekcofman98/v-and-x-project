/**
 * Grid Agent API Route
 * HTTP transport layer only — all business logic lives in:
 *   lib/server/services/ai-service/grid-agent.ts
 *
 * Responsibilities of this file:
 *   - Auth the caller and check table ownership/access
 *   - Validate the JSON request body with Zod (GridAgentTurnRequestSchema)
 *   - Delegate to runGridAgentTurn
 *   - Wrap the result in the standard { success, data } envelope
 *
 * Based on: docs/features/03_ai_table_agent.md §4.3, docs/11_API_ROUTES.md
 *
 * Note: rate limiting (per docs/features/03_ai_table_agent.md §4.3 — "10
 * agent turns/min/user") is intentionally not implemented here yet, matching
 * the schema-agent route's precedent: no rate-limiting infrastructure exists
 * in the repo, and an in-memory limiter would not enforce correctly across
 * Vercel serverless instances. Flagged as a follow-up.
 */

import { withErrorHandler, parseBody, apiSuccess, apiError } from '@/lib/shared/utils/api';
import { getAuthenticatedUser } from '@/lib/server/services/auth';
import { runGridAgentTurn } from '@/lib/server/services/ai-service/grid-agent';
import { GridAgentTurnRequestSchema } from '@/lib/shared/types/ai';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────
// POST /api/ai/grid-agent
// Run one turn of the tool-calling Grid Agent scoped to a table.
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError('Unauthorized', 401);

  const body = await parseBody(req, GridAgentTurnRequestSchema);
  if (!body.success) return body.errorResponse;

  try {
    const result = await runGridAgentTurn({
      userId: user.id,
      tableId: body.data.tableId,
      message: body.data.message,
      history: body.data.history,
    });
    return apiSuccess(result, 200);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) return apiError(error.message, 404);
      if (error.message.includes('Forbidden')) return apiError(error.message, 403);
    }
    throw error;
  }
});
