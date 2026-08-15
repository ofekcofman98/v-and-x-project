/**
 * Global Agent Execute API Route
 * HTTP transport layer only — all business logic lives in:
 *   lib/server/services/ai-service/tools/grid-tools.ts (executeUpdateCellsBatch)
 *   lib/server/cache/global-agent-cache.ts (pendingGlobalActionCache)
 *
 * Confirms and executes a previously proposed `updateCellsBatch` write.
 * The LLM is out of the loop here — this route re-fetches exactly the
 * updates that were previewed by `actionId` and writes nothing else. All
 * updates in one pending Global Agent action target the same table (the
 * model-supplied `tableId` on the originating tool call), so the target
 * table is read off `updates[0].tableId`.
 */

import { withErrorHandler, parseBody, apiSuccess, apiError } from '@/lib/shared/utils/api';
import { getAuthenticatedUser } from '@/lib/server/services/auth';
import { executeUpdateCellsBatch } from '@/lib/server/services/ai-service/tools/grid-tools';
import { pendingGlobalActionCache } from '@/lib/server/cache/global-agent-cache';
import { GlobalAgentExecuteRequestSchema } from '@/lib/shared/types/ai';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────
// POST /api/ai/global-agent/execute
// Confirm + execute a pending updateCellsBatch action.
// ─────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthenticatedUser();
  if (!user) return apiError('Unauthorized', 401);

  const body = await parseBody(req, GlobalAgentExecuteRequestSchema);
  if (!body.success) return body.errorResponse;

  const cached = pendingGlobalActionCache.get(body.data.actionId);
  if (!cached) return apiError('Action expired or not found', 404);

  if (cached.userId !== user.id) {
    return apiError('Forbidden: this action does not belong to you', 403);
  }

  const tableId = cached.updates[0]?.tableId;
  if (!tableId) return apiError('Action has no target table', 404);

  try {
    const updates = cached.updates.map(({ rowKey, columnKey, value }) => ({ rowKey, columnKey, value }));
    const result = await executeUpdateCellsBatch(tableId, user.id, updates);
    pendingGlobalActionCache.evict(body.data.actionId);
    return apiSuccess(result, 200);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) return apiError(error.message, 404);
      if (error.message.includes('Forbidden')) return apiError(error.message, 403);
    }
    throw error;
  }
});
