/**
 * Global Agent API Route
 * HTTP transport layer only — all business logic lives in:
 *   lib/server/services/ai-service/global-agent/agent.ts
 *
 * Responsibilities of this file:
 *   - Auth the caller and resolve their accessible organization IDs
 *   - Validate the JSON request body with Zod (GlobalAgentTurnRequestSchema)
 *   - Delegate to runGlobalAgentTurn
 *   - Wrap the result in the standard { success, data } envelope
 *
 * Mirrors app/api/ai/grid-agent/route.ts and app/api/ai/schema-agent/route.ts.
 * Rate limiting intentionally not implemented, matching those routes'
 * precedent (no rate-limiting infra exists in the repo yet).
 */

import { withErrorHandler, parseBody, apiSuccess, apiError } from '@/lib/shared/utils/api';
import { getAuthenticatedUser, getAccessibleOrganizationIds } from '@/lib/server/services/auth';
import { runGlobalAgentTurn } from '@/lib/server/services/ai-service/global-agent';
import { GlobalAgentTurnRequestSchema } from '@/lib/shared/types/ai';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────
// POST /api/ai/global-agent
// Run one turn of the tool-calling Global Agent scoped to a @BaseList mention.
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError('Unauthorized', 401);

  const body = await parseBody(req, GlobalAgentTurnRequestSchema);
  if (!body.success) return body.errorResponse;

  const organizationIds = await getAccessibleOrganizationIds(user.id);

  try {
    const result = await runGlobalAgentTurn({
      userId: user.id,
      organizationIds,
      mention: body.data.mentions[0],
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
