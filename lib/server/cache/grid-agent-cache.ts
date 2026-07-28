import { LRUCache } from 'lru-cache';
import type { PendingGridAction } from '@/lib/shared/types/ai';

/**
 * A `PendingGridAction` plus the scope it was proposed under. The execute
 * route re-checks `userId` before running the cached `updates[]` — the LLM
 * is out of the loop at execution time, and this is the record of exactly
 * what was previewed. Implements: docs/features/03_ai_table_agent.md §4.3.
 */
export interface CachedPendingAction extends PendingGridAction {
  tableId: string;
  userId: string;
}

/**
 * Grid Agent Pending Action Cache (Server-Side)
 *
 * Short-TTL store for write proposals awaiting user confirmation. A write
 * action is only ever executed by re-fetching it here via `actionId` — never
 * by re-deriving it from a fresh LLM call.
 */
class PendingGridActionCache {
  private cache: LRUCache<string, CachedPendingAction>;

  constructor() {
    this.cache = new LRUCache<string, CachedPendingAction>({
      max: 500,
      ttl: 1000 * 60 * 5, // 5 minutes — long enough to review a confirm dialog, short-lived by design
    });
  }

  set(action: CachedPendingAction): void {
    this.cache.set(action.actionId, action);
  }

  get(actionId: string): CachedPendingAction | null {
    return this.cache.get(actionId) ?? null;
  }

  evict(actionId: string): void {
    this.cache.delete(actionId);
  }
}

export const pendingGridActionCache = new PendingGridActionCache();
