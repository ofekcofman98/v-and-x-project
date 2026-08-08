import type { Matcher, MatchResult } from './types';

/**
 * Chain of Responsibility pattern for cascading matchers
 * Iterates through matchers in order until a match is found
 * Relocated from lib/server/matching/MatcherChain.ts — dependency-free,
 * isomorphic. docs/features/15_realtime_voice_feedback.md §3.3
 */
export class MatcherChain {
  private matchers: Matcher[] = [];

  constructor(matchers?: Matcher[]) {
    if (matchers) {
      this.matchers = matchers;
    }
  }

  /**
   * Add a matcher to the chain
   */
  addMatcher(matcher: Matcher): this {
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
  match(input: string, entities: string[], minConfidence: number = 0.85): MatchResult {
    for (const matcher of this.matchers) {
      const result = matcher.match(input, entities);

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
  getMatchers(): ReadonlyArray<Matcher> {
    return this.matchers;
  }
}
