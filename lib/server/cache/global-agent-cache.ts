import { LRUCache } from 'lru-cache';
import type { PendingGlobalAction } from '@/lib/shared/types/ai';

/**
 * A `PendingGlobalAction` plus the scope it was proposed under. Separate
 * cache/key-space from `pendingGridActionCache` so actionIds never collide
 * between the single-table Grid Agent and this multi-table Global Agent.
 */
export interface CachedPendingGlobalAction extends PendingGlobalAction {
  userId: string;
}

/**
 * Global Agent Pending Action Cache (Server-Side)
 *
 * Short-TTL store for write proposals awaiting user confirmation. A write
 * action is only ever executed by re-fetching it here via `actionId` — never
 * by re-deriving it from a fresh LLM call.
 */
class PendingGlobalActionCache {
  private cache: LRUCache<string, CachedPendingGlobalAction>;

  constructor() {
    this.cache = new LRUCache<string, CachedPendingGlobalAction>({
      max: 500,
      ttl: 1000 * 60 * 5, // 5 minutes — long enough to review a confirm dialog, short-lived by design
    });
  }

  set(action: CachedPendingGlobalAction): void {
    this.cache.set(action.actionId, action);
  }

  get(actionId: string): CachedPendingGlobalAction | null {
    return this.cache.get(actionId) ?? null;
  }

  evict(actionId: string): void {
    this.cache.delete(actionId);
  }
}

export const pendingGlobalActionCache = new PendingGlobalActionCache();
