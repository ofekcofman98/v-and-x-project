/**
 * Entity Index Cache
 * Per-instance LRU cache of hydrated EntityIndex objects, backed by the
 * `EntityEmbedding` Postgres table for cross-instance persistence.
 *
 * This replaces the Redis-backed design in
 * docs/features/10_voice-pipeline-hardening.md §3.3 — the repo has no
 * Redis instance, so Postgres (already available via Prisma) plays the
 * "durable store" role and `lru-cache` (already a dependency) plays the
 * "hot in-memory copy" role. Functionally equivalent: a cold instance
 * pays one Postgres read (~10-30ms) instead of one Redis read, and never
 * re-embeds unless the underlying labels actually changed.
 */

import { LRUCache } from 'lru-cache';
import { prisma } from '@/lib/prisma';
import { buildEntityIndex, hashLabels, packVectors, unpackVectors, type EntityIndex } from './entity-index';
import { EMBEDDING_MODEL_ID } from './embedding-service';

// Small cap: each entry can be several hundred KB (a few thousand
// entities x 384 floats), and only a handful of tables are "hot" on a
// given serverless instance at once.
const MAX_CACHED_TABLES = 50;

const memoryCache = new LRUCache<string, EntityIndex>({ max: MAX_CACHED_TABLES });

/**
 * Returns the hydrated index for `tableId`, preferring the in-memory LRU
 * copy. On a miss it reads the persisted row from Postgres and hydrates
 * the LRU before returning. Returns `null` if no index has been built for
 * this table yet — callers should treat that as "VectorMatcher unavailable,
 * fall through" rather than an error.
 */
export async function getEntityIndex(tableId: string): Promise<EntityIndex | null> {
  const cached = memoryCache.get(tableId);
  if (cached) return cached;

  const row = await prisma.entityEmbedding.findUnique({ where: { tableId } });
  if (!row) return null;

  const index: EntityIndex = {
    model: row.model,
    dim: row.dim,
    labels: row.labels,
    vectors: unpackVectors(row.vectors, row.dim, row.labels.length),
  };

  memoryCache.set(tableId, index);
  return index;
}

/**
 * Rebuilds the index for `tableId` from `labels`: embeds (unless the label
 * set is unchanged since the last build), upserts the Postgres row, and
 * refreshes the LRU entry. Intended to be called from the warm-cache job
 * (docs/features/01_cache_warming.md) on table open, representative-column
 * change, or row edits — never from the hot request path.
 */
export async function rebuildEntityIndex(tableId: string, labels: string[]): Promise<EntityIndex> {
  const labelsHash = hashLabels(labels);

  const existing = await prisma.entityEmbedding.findUnique({ where: { tableId } });
  if (existing && existing.labelsHash === labelsHash && existing.model === EMBEDDING_MODEL_ID) {
    // Labels unchanged since the last build — skip re-embedding, just
    // make sure the LRU has a warm copy.
    const index: EntityIndex = {
      model: existing.model,
      dim: existing.dim,
      labels: existing.labels,
      vectors: unpackVectors(existing.vectors, existing.dim, existing.labels.length),
    };
    memoryCache.set(tableId, index);
    return index;
  }

  const index = await buildEntityIndex(labels);

  await prisma.entityEmbedding.upsert({
    where: { tableId },
    create: {
      tableId,
      model: index.model,
      dim: index.dim,
      labels: index.labels,
      vectors: packVectors(index.vectors),
      labelsHash,
    },
    update: {
      model: index.model,
      dim: index.dim,
      labels: index.labels,
      vectors: packVectors(index.vectors),
      labelsHash,
    },
  });

  memoryCache.set(tableId, index);
  return index;
}

/**
 * Drops both the in-memory and persisted index for `tableId`. Hook this up
 * alongside the existing `entityCache.clear(tableId)` invalidation trigger
 * (schema change, entity edits) once VectorMatcher is wired into the chain.
 */
export async function invalidateEntityIndex(tableId: string): Promise<void> {
  memoryCache.delete(tableId);
  await prisma.entityEmbedding.deleteMany({ where: { tableId } });
}
