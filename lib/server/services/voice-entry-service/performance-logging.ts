import type { MatchType, ProcessingPath } from '@/lib/shared/types/voice-pipeline';
import { entityCache } from '@/lib/server/cache/entity-recognition-cache';

// ─────────────────────────────────────────────────────────────────────────────
// Performance budget (docs/10_PERFORMANCE.md)
// ─────────────────────────────────────────────────────────────────────────────

export const PERFORMANCE_BUDGET = {
  /** Optimal (no LLM) P50 target in ms */
  totalE2EOptimal: 1800,
  /** Total pipeline P95 budget in ms */
  totalE2E: 3500,
} as const;

interface PerformanceMetrics {
  transcript: string;
  transcriptionDuration: number;
  parsingDuration: number;
  totalDuration: number;
  matchType: MatchType;
  cached: boolean;
  pathTaken: ProcessingPath;
  llmDuration?: number;
}

/**
 * Logs per-request performance metrics and emits periodic cache statistics.
 * docs/10_PERFORMANCE.md §8.3
 */
export function logPerformanceStats(metrics: PerformanceMetrics): void {
  const {
    transcript,
    transcriptionDuration,
    parsingDuration,
    totalDuration,
    matchType,
    cached,
    pathTaken,
    llmDuration,
  } = metrics;

  const exceedsBudget = totalDuration > PERFORMANCE_BUDGET.totalE2E;
  const isOptimal = totalDuration <= PERFORMANCE_BUDGET.totalE2EOptimal;

  let recommendation = '';
  if (pathTaken === 'LLM_FALLBACK') {
    recommendation =
      '⚠️ LLM fallback used. Consider improving fuzzy matching or caching this entity.';
  } else if (isOptimal) {
    recommendation = '✅ OPTIMAL: Fast path achieved (no LLM). Maintain this pattern.';
  }

  const logEntry = {
    transcript: transcript.substring(0, 50),
    pathTaken,
    matchType,
    cached,
    transcriptionDuration: `${transcriptionDuration}ms`,
    parsingDuration: `${parsingDuration}ms`,
    llmDuration: llmDuration !== undefined ? `${llmDuration}ms` : 'N/A',
    totalDuration: `${totalDuration}ms`,
    budget: `${PERFORMANCE_BUDGET.totalE2E}ms`,
    exceedsBudget,
    isOptimal,
    recommendation,
  };

  if (exceedsBudget) {
    console.warn('[Performance] ⚠️ BUDGET EXCEEDED:', logEntry);
  } else {
    console.log('[Performance] ✅', logEntry);
  }

  // Sample 10 % of requests for cache statistics to avoid log noise
  if (Math.random() < 0.1) {
    const stats = entityCache.getStats();
    console.log('[EntityCache] Statistics:', {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
      size: stats.size,
      estimatedTimeSaved: `${(stats.estimatedTimeSaved / 1000).toFixed(1)}s`,
    });
  }
}
