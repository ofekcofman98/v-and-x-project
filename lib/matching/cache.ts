import { LRUCache } from 'lru-cache';
import { MatchResult } from './types';

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
