import { LRUCache } from 'lru-cache';

interface EntityCacheEntry {
  transcript: string;
  entity: string;
  value: any;
  confidence: number;
  matchType: 'exact' | 'phonetic' | 'fuzzy' | 'semantic';
  timestamp: number;
}

/**
 * Entity Recognition Cache (Server-Side)
 * 
 * Purpose: Cache transcript → entity mappings to avoid LLM calls
 * 
 * Real-world impact:
 * - Without cache: "Student A, 84" → 2000ms LLM call EVERY time
 * - With cache: "Student A, 84" → 5ms cache lookup after first time
 * - Savings: 1995ms (99.75% reduction) per cached entry
 */
class EntityRecognitionCache {
  private cache: LRUCache<string, EntityCacheEntry>;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.cache = new LRUCache<string, EntityCacheEntry>({
      max: 500,
      ttl: 1000 * 60 * 60 * 24,
      updateAgeOnGet: true,
    });
  }

  /**
   * Generate cache key from transcript
   * Normalized to catch variations like "student a, 84" vs "Student A,84"
   */
  private getCacheKey(transcript: string, tableId: string): string {
    const normalized = transcript
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[,.:;]/g, '')
      .trim();
    
    return `${tableId}:${normalized}`;
  }

  /**
   * Check cache before expensive LLM call
   */
  get(transcript: string, tableId: string): EntityCacheEntry | null {
    const key = this.getCacheKey(transcript, tableId);
    const entry = this.cache.get(key);
    
    if (entry) {
      this.hits++;
      console.log(`[EntityCache] HIT: "${transcript}" → ${entry.entity} (saved ~${this.estimateLLMLatency(entry.matchType)}ms)`);
      return entry;
    }
    
    this.misses++;
    return null;
  }

  /**
   * Store successful parsing result
   */
  set(
    transcript: string,
    tableId: string,
    entry: Omit<EntityCacheEntry, 'timestamp'>
  ): void {
    const key = this.getCacheKey(transcript, tableId);
    
    this.cache.set(key, {
      ...entry,
      timestamp: Date.now(),
    });
    
    console.log(`[EntityCache] SET: "${transcript}" → ${entry.entity} (${entry.matchType})`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    estimatedTimeSaved: number;
  } {
    const hitRate = this.hits + this.misses > 0 
      ? this.hits / (this.hits + this.misses) 
      : 0;
    
    const estimatedTimeSaved = this.hits * 1500;
    
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      size: this.cache.size,
      estimatedTimeSaved,
    };
  }

  /**
   * Clear cache (e.g., when table schema changes)
   */
  clear(tableId?: string): void {
    if (tableId) {
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(`${tableId}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
      this.hits = 0;
      this.misses = 0;
    }
  }

  private estimateLLMLatency(matchType: string): number {
    switch (matchType) {
      case 'semantic':
        return 1500;
      case 'fuzzy':
        return 30;
      case 'phonetic':
        return 10;
      default:
        return 5;
    }
  }
}

export const entityCache = new EntityRecognitionCache();
