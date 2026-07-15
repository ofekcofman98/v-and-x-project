/**
 * Entity Index
 * In-memory vector index for a table's entity labels, plus the pack/unpack
 * helpers used to persist it as a single `Bytes` column (Prisma
 * `EntityEmbedding.vectors`) instead of one row per vector.
 *
 * docs/features/10_voice-pipeline-hardening.md §3.3
 */

import { createHash } from 'crypto';
import { embed, EMBEDDING_DIM, EMBEDDING_MODEL_ID } from './embedding-service';

export interface EntityIndex {
  model: string;
  dim: number;
  /** Entity labels, in the same order as their vectors below. */
  labels: string[];
  /** L2-normalized embeddings, one per label. */
  vectors: Float32Array[];
}

export interface ScoredEntity {
  label: string;
  score: number;
}

/**
 * Embeds every label in one batched forward pass and returns the resulting
 * in-memory index. Callers persist the result via `packVectors` /
 * `EntityEmbedding` — this function does no I/O.
 */
export async function buildEntityIndex(labels: string[]): Promise<EntityIndex> {
  const vectors = await embed(labels.map(normalizeForEmbedding));
  return { model: EMBEDDING_MODEL_ID, dim: EMBEDDING_DIM, labels, vectors };
}

/**
 * Returns the top-`k` labels by cosine similarity to `query`. Vectors are
 * pre-normalized (see embedding-service.ts), so cosine similarity is a
 * plain dot product — no division by magnitudes needed.
 */
export function cosineTopK(query: Float32Array, index: EntityIndex, k = 3): ScoredEntity[] {
  const scored = index.vectors.map((vector, i) => ({
    label: index.labels[i],
    score: dot(query, vector),
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/** Whitespace/case normalization applied before embedding — keeps cache-key style consistent with the matcher chain's own normalization. */
export function normalizeForEmbedding(label: string): string {
  return label.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Vector packing — Float32Array[] <-> Buffer (for the Postgres `Bytes` column)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Packs an array of equal-length Float32 vectors into a single contiguous
 * Buffer: `vectors.length * dim * 4` bytes, vectors concatenated in order,
 * little-endian (the platform-native byte order Node uses for Float32Array).
 * This lets the whole embedding matrix for a table live in one `Bytes`
 * column instead of `labels.length` separate rows.
 */
export function packVectors(vectors: Float32Array[]): Uint8Array<ArrayBuffer> {
  if (vectors.length === 0) return new Uint8Array(0);

  const dim = vectors[0].length;
  // Plain ArrayBuffer-backed Uint8Array (not Node's Buffer) — Prisma's
  // `Bytes` field type requires Uint8Array<ArrayBuffer>, which Buffer
  // doesn't structurally satisfy (its backing store can be a
  // SharedArrayBuffer).
  const bytes = new Uint8Array(vectors.length * dim * Float32Array.BYTES_PER_ELEMENT);

  vectors.forEach((vector, i) => {
    // vector is itself Float32Array-typed bytes; view it as bytes and copy.
    const view = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
    bytes.set(view, i * dim * Float32Array.BYTES_PER_ELEMENT);
  });

  return bytes;
}

/**
 * Inverse of `packVectors`: splits a flat Buffer back into `count`
 * Float32Array views of length `dim`. Each returned array is a *copy*
 * (not a view into `buffer`) so it remains valid after the source Buffer
 * is garbage-collected or reused.
 */
export function unpackVectors(bytes: Uint8Array, dim: number, count: number): Float32Array[] {
  const vectors: Float32Array[] = [];
  const vectorByteLength = dim * Float32Array.BYTES_PER_ELEMENT;

  for (let i = 0; i < count; i++) {
    const start = i * vectorByteLength;
    // Float32Array requires an offset that's a multiple of
    // BYTES_PER_ELEMENT relative to its own buffer; slice() copies,
    // sidestepping alignment issues with Node's pooled Buffer allocations.
    const slice = bytes.buffer.slice(bytes.byteOffset + start, bytes.byteOffset + start + vectorByteLength);
    vectors.push(new Float32Array(slice));
  }

  return vectors;
}

/**
 * Cheap fingerprint of a label list, used to detect whether a table's
 * entities changed since the index was last built (skip re-embedding when
 * unchanged).
 */
export function hashLabels(labels: string[]): string {
  return createHash('sha256').update(labels.join('')).digest('hex');
}
