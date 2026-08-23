/**
 * Grid Agent Execute API Route
 * HTTP transport layer only — all business logic lives in:
 *   lib/server/services/ai-service/tools/grid-tools.ts (executeUpdateCellsBatch)
 *   lib/server/cache/grid-agent-cache.ts (pendingGridActionCache)
 *
 * Confirms and executes a previously proposed `updateCellsBatch` write.
 * The LLM is out of the loop here — this route re-fetches exactly the
 * updates that were previewed by `actionId` and writes nothing else.
 * Based on: docs/features/03_ai_table_agent.md §4.3.
 */

import { withErrorHandler, parseBody, apiSuccess, apiError } from '@/lib/shared/utils/api';
import { getAuthenticatedUser } from '@/lib/server/services/auth';
import { executeUpdateCellsBatch } from '@/lib/server/services/ai-service/tools/grid-tools';
import { pendingGridActionCache } from '@/lib/server/cache/grid-agent-cache';
import { GridAgentExecuteRequestSchema } from '@/lib/shared/types/ai';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────
// POST /api/ai/grid-agent/execute
// Confirm + execute a pending updateCellsBatch action.
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError('Unauthorized', 401);

  const body = await parseBody(req, GridAgentExecuteRequestSchema);
  if (!body.success) return body.errorResponse;

  const cached = pendingGridActionCache.get(body.data.actionId);
  if (!cached) return apiError('Action expired or not found', 404);

  if (cached.userId !== user.id) {
    return apiError('Forbidden: this action does not belong to you', 403);
  }

  try {
    const result = await executeUpdateCellsBatch(cached.tableId, user.id, cached.updates);
    pendingGridActionCache.evict(body.data.actionId);
    return apiSuccess(result, 200);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) return apiError(error.message, 404);
      if (error.message.includes('Forbidden')) return apiError(error.message, 403);
    }
    throw error;
  }
});
