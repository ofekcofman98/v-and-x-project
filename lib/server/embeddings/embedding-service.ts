/**
 * Embedding Service
 * Lazy-singleton wrapper around a local ONNX sentence-embedding model,
 * used to power VectorMatcher (Level 4 of the matcher chain).
 *
 * Model: paraphrase-multilingual-MiniLM-L12-v2 — Hebrew + English share a
 * vector space, which is what lets "דוד לוי" match "David Levy" without
 * transliteration. See docs/features/10_voice-pipeline-hardening.md §3.1.
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

// Bundle the model with the deployment rather than fetching it at runtime —
// avoids a network round trip (and a hard failure if the host is offline)
// on every cold Vercel instance.
env.localModelPath = process.env.MODEL_PATH ?? './models';
env.allowRemoteModels = process.env.NODE_ENV !== 'production';

export const EMBEDDING_MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const EMBEDDING_DIM = 384;

// Module-level singleton: the ONNX session is expensive to initialize
// (~1-2s) but cheap to reuse, so we pay that cost once per warm instance.
let embedderPromise: Promise<FeatureExtractionPipeline> | null = null;

export function getEmbedder(): Promise<FeatureExtractionPipeline> {
  embedderPromise ??= pipeline('feature-extraction', EMBEDDING_MODEL_ID, { dtype: 'q8' }) as Promise<FeatureExtractionPipeline>;
  return embedderPromise;
}

/**
 * Embeds a batch of strings in a single forward pass. Output vectors are
 * mean-pooled and L2-normalized, so cosine similarity reduces to a plain
 * dot product (see entity-index.ts `dot()`).
 */
export async function embed(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  const extractor = await getEmbedder();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });

  // transformers.js returns a single batched Tensor; each row is one
  // input's embedding, `dim` floats wide.
  const dim = output.dims[output.dims.length - 1];
  const flat = output.data as Float32Array;

  return texts.map((_, i) => flat.subarray(i * dim, (i + 1) * dim));
}

/** Embeds a single string. Thin convenience wrapper over {@link embed}. */
export async function embedOne(text: string): Promise<Float32Array> {
  const [vector] = await embed([text]);
  return vector;
}
