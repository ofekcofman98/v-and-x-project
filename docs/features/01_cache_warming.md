# Representative Column Selection & Cache Warming

**Priority:** High  
**Dependencies:** 14_PRODUCT_DATA_FLOW.md, 07_MATCHING_ENGINE.md, lib/matching/cache.ts  
**Status:** Done

---

## Overview

Allow users to explicitly select which column serves as the representative identifier for voice matching, with intelligent cache pre-warming for frequently used entities.

**User Story:**
- User creates a Table from a BaseList
- UI presents all text-type columns as radio options for representative column selection
- User sees example voice input format for each option ("Alice, 92" vs "001, 92")
- System pre-warms entity cache upon table creation to minimize first-match latency

**Impact:**
- Eliminates 53% latency on repeated voice inputs (cache hit)
- Reduces P95 end-to-end latency from 3900ms to 1305ms for cached entities
- Improves user experience during rapid voice data entry sessions

**Existing Infrastructure:**
- Cache implementation exists at `lib/matching/cache.ts`
- Current cache structure supports entity-to-transcript mapping
- Integration point: Voice matching pipeline (POST /api/parse)

---

## Database Schema

**No schema changes required.** Representative column already exists in `tables.representative_column`.

**Cache Layer (Redis/Upstash recommended):**

```typescript
// Cache key pattern
const CACHE_KEY = `table:${tableId}:entity:${normalizedTranscript}`;

// Cache structure (extends existing lib/matching/cache.ts)
interface CachedEntityMatch {
  entityId: string;
  entityLabel: string;
  confidence: number;
  matchedAt: number;  // Unix timestamp
  ttl: number;        // 86400 (24 hours)
}

// Cache storage format
{
  "table:uuid-123:entity:alice": {
    "entityId": "entity-uuid-456",
    "entityLabel": "Alice Johnson",
    "confidence": 1.0,
    "matchedAt": 1716748800,
    "ttl": 86400
  }
}
```

---

## API Contract

**PATCH /api/tables/:id/representative-column**

Request:
```json
{
  "representative_column": "student_id"
}
```

Response:
```json
{
  "data": {
    "id": "table-uuid",
    "representative_column": "student_id",
    "cache_warmed": true,
    "cached_entities": 30
  }
}
```

**POST /api/tables/:id/warm-cache**

Request:
```json
{
  "force": false
}
```

Response:
```json
{
  "data": {
    "entities_cached": 30,
    "cache_duration_ms": 245,
    "ttl": 86400
  }
}
```

**Integration with existing /api/parse:**

```typescript
// Before matching, check cache
const cacheKey = `table:${tableId}:entity:${normalizeTranscript(transcript)}`;
const cached = await cache.get(cacheKey);

if (cached) {
  return {
    entity: cached.entityLabel,
    confidence: cached.confidence,
    source: 'cache',
    latency_ms: 5  // Cache hit latency
  };
}

// Fall through to existing 4-level cascade if cache miss
```

---

## Type Definitions

```typescript
interface RepresentativeColumnOption {
  columnId: string;
  columnLabel: string;
  exampleVoiceInput: string;      // "Alice, 92" or "001, 92"
  uniqueValueCount: number;       // Number of unique values
  recommended: boolean;           // Auto-detect best option
}

interface CacheWarmingResult {
  success: boolean;
  entitiesCached: number;
  duration: number;
  errors?: string[];
}

interface CacheWarmingJob {
  tableId: string;
  representativeColumn: string;
  entityCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
}
```

---

## Implementation Checklist

**UI Components:**
- [ ] Create `RepresentativeColumnSelector.tsx` component
- [ ] Add radio button interface showing all text columns
- [ ] Display example voice input for each column option
- [ ] Show unique value count and recommendation badge
- [ ] Integrate into Table creation wizard (Step 2)
- [ ] Add "Change Representative Column" option in table settings

**Backend:**
- [ ] Extend existing `lib/matching/cache.ts` with warm-cache function
- [ ] Implement POST `/api/tables/:id/warm-cache` route
- [ ] Implement PATCH `/api/tables/:id/representative-column` route
- [ ] Pre-compute entity vocabulary for selected representative column
- [ ] Store in Redis/Upstash with 24hr TTL
- [ ] Update matching engine to check cache before LLM fallback
- [ ] Add cache invalidation on table schema changes
- [ ] Add cache invalidation on BaseList entity updates

**Validation:**
- [ ] Validate representative column exists in table schema
- [ ] Validate representative column is type `text`
- [ ] Validate representative column has unique values (warn if duplicates)
- [ ] Show validation errors in UI

**Performance:**
- [ ] Measure cache hit rate (target: 60-80%)
- [ ] Monitor cache warm duration (target: <500ms for 100 entities)
- [ ] Track latency reduction (target: 53% improvement on cache hits)
- [ ] Add CloudWatch/Datadog metrics for cache performance
- [ ] Implement cache eviction policy (LRU)

**Testing:**
- [ ] Test cache warming with 10, 50, 100, 500 entities
- [ ] Test cache hit/miss scenarios
- [ ] Test cache invalidation on schema changes
- [ ] Test concurrent cache access
- [ ] Load test: 100 requests/sec with 80% cache hit rate

**Documentation:**
- [ ] Update 07_MATCHING_ENGINE.md with cache layer details
- [ ] Document cache key patterns
- [ ] Document TTL and eviction policies
- [ ] Add performance benchmarks to docs

---

**Estimated Effort:** 2 weeks  
**Dependencies:** Redis/Upstash setup, existing cache.ts refactor