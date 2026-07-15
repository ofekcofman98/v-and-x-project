import { embedOne } from '@/lib/server/embeddings/embedding-service';
import { getEntityIndex } from '@/lib/server/embeddings/entity-index-cache';
import { cosineTopK, normalizeForEmbedding } from '@/lib/server/embeddings/entity-index';
import type { AsyncMatcher, MatchResult } from './types';

interface VectorMatcherOptions {
  /** Minimum cosine similarity to accept a match. Deliberately below the
   * chain's 0.85 sync threshold — the multilingual model's cosine scores
   * aren't calibrated to fuzzy-ratio semantics. docs/features/10 §5. */
  minScore: number;
  /** Minimum score gap between the top-1 and top-2 candidate required to
   * accept top-1 outright; below this the result is ambiguous. */
  minMargin: number;
  /** Embedding call budget — a slow/cold ONNX session must never block the
   * chain; on timeout we fall through to the LLM fallback instead. */
  timeoutMs: number;
}

const DEFAULT_OPTIONS: VectorMatcherOptions = {
  minScore: 0.75,
  minMargin: 0.05,
  timeoutMs: 300,
};

/**
 * Level 4 of the matcher chain: local semantic (embedding) match, run only
 * when exact/phonetic/fuzzy all miss. Bound to a single table's entity
 * index at construction time (one instance per request is expected — see
 * `createDefaultAsyncMatcherChain`).
 *
 * docs/features/10_voice-pipeline-hardening.md §3.4
 */
export class VectorMatcher implements AsyncMatcher {
  readonly name = 'vector';

  private readonly opts: VectorMatcherOptions;

  constructor(
    private readonly tableId: string,
    opts: Partial<VectorMatcherOptions> = {}
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  async match(input: string, _entities: string[]): Promise<MatchResult> {
    // Entity index is a per-table cache miss, never a request-time build —
    // if it hasn't been (re)built yet, skip vector matching entirely rather
    // than embedding on the hot path with no index to compare against.
    const index = await getEntityIndex(this.tableId);
    if (!index) return this.noMatch();

    try {
      const query = await this.withTimeout(
        embedOne(normalizeForEmbedding(input)),
        this.opts.timeoutMs
      );
      const [top1, top2] = cosineTopK(query, index, 2);

      if (!top1 || top1.score < this.opts.minScore) return this.noMatch();

      if (top2 && top1.score - top2.score < this.opts.minMargin) {
        // Ambiguous: two candidates are close enough that guessing is
        // risky. Surface both via `candidates` so the caller can route to
        // the existing AMBIGUOUS UI instead of silently picking one.
        return {
          matched: null,
          confidence: top1.score,
          matchType: 'semantic',
          candidates: [top1, top2].map((c) => ({ entity: c.label, score: c.score })),
        };
      }

      return { matched: top1.label, confidence: top1.score, matchType: 'semantic' };
    } catch {
      // Timeout or embedding failure — never block the chain, just miss
      // through to the LLM fallback.
      return this.noMatch();
    }
  }

  private noMatch(): MatchResult {
    return { matched: null, confidence: 0, matchType: 'none' };
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('VectorMatcher: embedding timed out')), ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      );
    });
  }
}
