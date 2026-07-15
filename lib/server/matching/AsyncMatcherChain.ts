import type { AsyncMatcher, Matcher, MatchResult } from './types';

/**
 * Async counterpart of MatcherChain (lib/server/matching/MatcherChain.ts).
 * Accepts both sync Matcher and AsyncMatcher steps — `await`ing a plain
 * (non-Promise) return value from a sync matcher resolves immediately, so
 * one loop can drive both without the chain needing to know which is which.
 *
 * Existing sync MatcherChain is left untouched; this class is additive.
 * docs/features/10_voice-pipeline-hardening.md §3.5
 */
export class AsyncMatcherChain {
  private matchers: Array<Matcher | AsyncMatcher> = [];

  constructor(matchers?: Array<Matcher | AsyncMatcher>) {
    if (matchers) {
      this.matchers = matchers;
    }
  }

  /**
   * Add a matcher (sync or async) to the chain
   */
  addMatcher(matcher: Matcher | AsyncMatcher): this {
    this.matchers.push(matcher);
    return this;
  }

  /**
   * Remove all matchers from the chain
   */
  clear(): this {
    this.matchers = [];
    return this;
  }

  /**
   * Execute the chain: try each matcher until one succeeds
   */
  async match(input: string, entities: string[], minConfidence: number = 0.85): Promise<MatchResult> {
    for (const matcher of this.matchers) {
      const result = await matcher.match(input, entities);

      if (result.matched && result.confidence >= minConfidence) {
        return result;
      }
    }

    return {
      matched: null,
      confidence: 0,
      matchType: 'none',
    };
  }

  /**
   * Get all matchers in the chain
   */
  getMatchers(): ReadonlyArray<Matcher | AsyncMatcher> {
    return this.matchers;
  }
}
