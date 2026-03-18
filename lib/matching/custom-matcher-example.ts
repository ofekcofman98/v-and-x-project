/**
 * Example: Custom Matcher Implementation
 * 
 * This example shows how easy it is to create custom matchers
 * with the new Chain of Responsibility pattern.
 */

import type { Matcher, MatchResult } from './types';
import { MatcherChain, ExactMatcher, PhoneticMatcher, FuzzyMatcher } from './index';

/**
 * Example 1: Nickname Matcher
 * Maps common nicknames to full names
 */
class NicknameMatcher implements Matcher {
  readonly name = 'nickname';
  
  private nicknameMap: Record<string, string[]> = {
    'mike': ['michael', 'mikhail'],
    'bob': ['robert'],
    'bill': ['william'],
    'dick': ['richard'],
    'jim': ['james'],
    'joe': ['joseph'],
    'jon': ['jonathan'],
    'tony': ['anthony'],
    'chris': ['christopher'],
    'dave': ['david'],
    'steve': ['steven'],
  };

  match(input: string, entities: string[]): MatchResult {
    const normalized = input.toLowerCase().trim();
    const fullNames = this.nicknameMap[normalized];
    
    if (!fullNames) {
      return this.noMatch();
    }
    
    // Try to find entity matching any of the full names
    for (const fullName of fullNames) {
      for (const entity of entities) {
        const entityLower = entity.toLowerCase();
        if (entityLower.includes(fullName)) {
          return {
            matched: entity,
            confidence: 0.92,
            matchType: 'semantic',
          };
        }
      }
    }
    
    return this.noMatch();
  }

  private noMatch(): MatchResult {
    return { matched: null, confidence: 0, matchType: 'none' };
  }
}

/**
 * Example 2: Acronym Matcher
 * Matches initials to full names (e.g., "JS" → "John Smith")
 */
class AcronymMatcher implements Matcher {
  readonly name = 'acronym';

  match(input: string, entities: string[]): MatchResult {
    const normalized = input.toLowerCase().replace(/[^a-z]/g, '');
    
    for (const entity of entities) {
      const initials = entity
        .split(' ')
        .map(word => word[0].toLowerCase())
        .join('');
      
      if (initials === normalized) {
        return {
          matched: entity,
          confidence: 0.88,
          matchType: 'fuzzy',
        };
      }
    }
    
    return { matched: null, confidence: 0, matchType: 'none' };
  }
}

/**
 * Example 3: Weighted Matcher
 * Allows prioritization with weights/priorities
 */
interface WeightedMatcher extends Matcher {
  readonly priority: number;
}

class WeightedMatcherChain extends MatcherChain {
  private weightedMatchers: WeightedMatcher[] = [];

  addWeightedMatcher(matcher: WeightedMatcher): this {
    this.weightedMatchers.push(matcher);
    this.weightedMatchers.sort((a, b) => a.priority - b.priority);
    return this;
  }

  // Override to use weighted matchers
  match(input: string, entities: string[], minConfidence = 0.85): MatchResult {
    for (const matcher of this.weightedMatchers) {
      const result = matcher.match(input, entities);
      if (result.matched && result.confidence >= minConfidence) {
        return result;
      }
    }
    return { matched: null, confidence: 0, matchType: 'none' };
  }
}

/**
 * Usage Examples
 */

// Example 1: Adding custom matchers to existing chain
export function createExtendedMatcherChain(): MatcherChain {
  return new MatcherChain()
    .addMatcher(new ExactMatcher())
    .addMatcher(new NicknameMatcher())      // Custom!
    .addMatcher(new AcronymMatcher())       // Custom!
    .addMatcher(new PhoneticMatcher())
    .addMatcher(new FuzzyMatcher(2));
}

// Example 2: Nickname-only matching
export function createNicknameChain(): MatcherChain {
  return new MatcherChain()
    .addMatcher(new NicknameMatcher());
}

// Example 3: Testing
export function testCustomMatchers() {
  const entities = [
    'Michael Smith',
    'Robert Johnson',
    'Jonathan Davis',
    'John Smith',
  ];

  const chain = createExtendedMatcherChain();

  console.log('Test 1: Nickname');
  const test1 = chain.match('mike smith', entities);
  console.log(test1); // Should match "Michael Smith"

  console.log('\nTest 2: Acronym');
  const test2 = chain.match('js', entities);
  console.log(test2); // Should match "John Smith"

  console.log('\nTest 3: Combined');
  const test3 = chain.match('jon', entities);
  console.log(test3); // Should match "Jonathan Davis" via nickname or phonetic
}

// Uncomment to run tests:
// testCustomMatchers();
