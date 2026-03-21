import { LRUCache } from 'lru-cache';
import { MatchResult } from './types';
import type { RowDefinition } from '@/lib/types/table-schema';

const matchCache = new LRUCache<string, MatchResult>({
  max: 500,
  ttl: 1000 * 60 * 5,
});

function getCacheKey(input: string, entities: string[]): string {
  return `${input}:${entities.sort().join(',')}`;
}

export function getCachedMatch(
  input: string,
  entities: string[]
): MatchResult | undefined {
  const key = getCacheKey(input, entities);
  return matchCache.get(key);
}

export function setCachedMatch(
  input: string,
  entities: string[],
  result: MatchResult
): void {
  const key = getCacheKey(input, entities);
  matchCache.set(key, result);
}

/**
 * Normalize entity label for consistent caching
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Proactive Cache Warming
 * Pre-populate the EntityRecognitionCache with all existing student names
 * from the table schema to avoid any LLM parsing for known entities.
 * 
 * Purpose: Pre-load all row labels as exact matches with 1.0 confidence
 * Impact: First-time voice input for any student will be instant (5ms vs 1500ms LLM call)
 * 
 * Called on hook initialization and whenever tableSchema.rows change
 */
export function warmEntityCache(rows: RowDefinition[]): void {
  const startTime = Date.now();
  let warmedCount = 0;

  const allLabels = rows.map((row) => row.label);

  for (const row of rows) {
    const normalizedLabel = normalizeLabel(row.label);
    
    const result: MatchResult = {
      matched: row.label,
      confidence: 1.0,
      matchType: 'exact',
      candidates: [{ entity: row.label, score: 1.0 }],
    };

    setCachedMatch(normalizedLabel, allLabels, result);
    warmedCount++;
  }

  const duration = Date.now() - startTime;
  console.log(
    `[EntityCache] 🔥 Warmed cache with ${warmedCount} entities in ${duration}ms`
  );
}
