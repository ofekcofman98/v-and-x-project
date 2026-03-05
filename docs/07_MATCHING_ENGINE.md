# VocalGrid - Semantic Matching Engine

**Chapter:** 07  
**Dependencies:** 05_VOICE_PIPELINE.md  
**Related:** 09_ERROR_HANDLING.md

---

## Table of Contents

1. [Matching Engine Overview](#1-matching-engine-overview)
   - 1.1 [Purpose](#11-purpose)
   - 1.2 [Cascading Strategy](#12-cascading-strategy)

2. [Level 1: Exact Match](#2-level-1-exact-match)
   - 2.1 [Implementation](#21-implementation)

3. [Level 2: Phonetic Match](#3-level-2-phonetic-match)
   - 3.1 [Soundex Algorithm](#31-soundex-algorithm)
   - 3.2 [Metaphone (Alternative)](#32-metaphone-alternative)

4. [Level 3: Levenshtein Distance](#4-level-3-levenshtein-distance)
   - 4.1 [Implementation](#41-implementation)
   - 4.2 [Optimized Implementation](#42-optimized-implementation)

5. [Level 4: LLM Semantic Match](#5-level-4-llm-semantic-match)
   - 5.1 [Implementation](#51-implementation)

6. [Unified Matching Function](#6-unified-matching-function)
   - 6.1 [Cascading Matcher](#61-cascading-matcher)
   - 6.2 [Usage Example](#62-usage-example)

7. [Partial Name Matching](#7-partial-name-matching)
   - 7.1 [First Name Only](#71-first-name-only)
   - 7.2 [Last Name Only](#72-last-name-only)

8. [Ambiguity Resolution](#8-ambiguity-resolution)
   - 8.1 [Detecting Ambiguity](#81-detecting-ambiguity)
   - 8.2 [User Disambiguation UI](#82-user-disambiguation-ui)

9. [Performance Optimization](#9-performance-optimization)
   - 9.1 [Caching](#91-caching)
   - 9.2 [Early Termination](#92-early-termination)

10. [Testing](#10-testing)
    - 10.1 [Unit Tests](#101-unit-tests)
    - 10.2 [Integration Tests](#102-integration-tests)

11. [Matching Engine Checklist](#11-matching-engine-checklist)

---

## 1. Matching Engine Overview

### 1.1 Purpose

The **Matching Engine** is responsible for mapping spoken input to table entities (rows) with high accuracy, even when:
- Users make pronunciation errors
- Names are abbreviated or partial
- Accents affect transcription
- Similar names exist in the table

### 1.2 Cascading Strategy
```
┌─────────────────────────────────────────────────────────────┐
│              MATCHING PIPELINE (Cascading)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input: "jon smith"                                         │
│  Available entities: ["John Smith", "Jonathan Smith",      │
│                       "Joan Rivers", "Mike Brown"]          │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ LEVEL 1: Exact Match (Case-Insensitive)          │      │
│  │ Complexity: O(n)                                  │      │
│  │ Speed: ~1ms                                       │      │
│  ├──────────────────────────────────────────────────┤      │
│  │ Compare: "jon smith" === "john smith"            │      │
│  │ Result: ✓ Match found                            │      │
│  │ Entity: "John Smith"                             │      │
│  │ Confidence: 1.0                                  │      │
│  └──────────────────────────────────────────────────┘      │
│                    │                                        │
│                    │ (If no match, continue)                │
│                    ▼                                        │
│  ┌──────────────────────────────────────────────────┐      │
│  │ LEVEL 2: Phonetic Match (Soundex/Metaphone)      │      │
│  │ Complexity: O(n)                                  │      │
│  │ Speed: ~5ms                                       │      │
│  ├──────────────────────────────────────────────────┤      │
│  │ Soundex("jon") = J500                            │      │
│  │ Soundex("john") = J500                           │      │
│  │ Result: ✓ Match found                            │      │
│  │ Confidence: 0.95                                 │      │
│  └──────────────────────────────────────────────────┘      │
│                    │                                        │
│                    │ (If no match, continue)                │
│                    ▼                                        │
│  ┌──────────────────────────────────────────────────┐      │
│  │ LEVEL 3: Levenshtein Distance (Fuzzy)            │      │
│  │ Complexity: O(n * m²)                             │      │
│  │ Speed: ~10-20ms                                   │      │
│  ├──────────────────────────────────────────────────┤      │
│  │ Distance("jon smith", "John Smith") = 1          │      │
│  │ Threshold: ≤ 2 characters                        │      │
│  │ Result: ✓ Match found                            │      │
│  │ Confidence: 0.90                                 │      │
│  └──────────────────────────────────────────────────┘      │
│                    │                                        │
│                    │ (If no match, continue)                │
│                    ▼                                        │
│  ┌──────────────────────────────────────────────────┐      │
│  │ LEVEL 4: LLM Semantic Match (GPT-4o-mini)        │      │
│  │ Complexity: API call                              │      │
│  │ Speed: ~500-1000ms                                │      │
│  ├──────────────────────────────────────────────────┤      │
│  │ Prompt: "Which of these matches 'jon smith'?"    │      │
│  │ Options: [all entities]                          │      │
│  │ Result: "John Smith"                             │      │
│  │ Confidence: 0.88 (from LLM)                      │      │
│  └──────────────────────────────────────────────────┘      │
│                    │                                        │
│                    │ (If still no match)                    │
│                    ▼                                        │
│  ┌──────────────────────────────────────────────────┐      │
│  │ LEVEL 5: No Match / Ambiguous                    │      │
│  ├──────────────────────────────────────────────────┤      │
│  │ If confidence < 0.85:                            │      │
│  │   → Return top 3 candidates                      │      │
│  │   → Ask user to choose                           │      │
│  │                                                  │      │
│  │ If no candidates:                                │      │
│  │   → Offer to create new entity                  │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Level 1: Exact Match

### 2.1 Implementation
```typescript
// lib/matching/exact-match.ts

export interface MatchResult {
  matched: string | null;
  confidence: number;
  matchType: 'exact' | 'phonetic' | 'fuzzy' | 'semantic' | 'none';
  candidates?: Array<{ entity: string; score: number }>;
}

/**
 * Exact match (case-insensitive, whitespace-normalized)
 */
export function exactMatch(
  input: string,
  entities: string[]
): MatchResult {
  const normalized = normalizeString(input);
  
  for (const entity of entities) {
    if (normalizeString(entity) === normalized) {
      return {
        matched: entity,
        confidence: 1.0,
        matchType: 'exact',
      };
    }
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

// Examples:
// exactMatch("john smith", ["John Smith"]) → matched: "John Smith", confidence: 1.0
// exactMatch("JOHN  SMITH", ["John Smith"]) → matched: "John Smith", confidence: 1.0
// exactMatch("jon", ["John Smith"]) → matched: null
```

---

## 3. Level 2: Phonetic Match

### 3.1 Soundex Algorithm
```typescript
// lib/matching/phonetic-match.ts

/**
 * Soundex algorithm for phonetic matching
 * Maps similar-sounding words to the same code
 */
export function soundex(name: string): string {
  // Convert to uppercase
  const upper = name.toUpperCase();
  
  // Keep first letter
  let code = upper[0];
  
  // Mapping table
  const soundexMap: { [key: string]: string } = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };
  
  // Process remaining letters
  for (let i = 1; i < upper.length; i++) {
    const char = upper[i];
    const digit = soundexMap[char];
    
    if (digit && digit !== code[code.length - 1]) {
      code += digit;
    }
    
    if (code.length === 4) break;
  }
  
  // Pad with zeros
  return code.padEnd(4, '0');
}

/**
 * Phonetic matching using Soundex
 */
export function phoneticMatch(
  input: string,
  entities: string[]
): MatchResult {
  const inputWords = input.toLowerCase().split(' ');
  const inputCodes = inputWords.map(soundex);
  
  for (const entity of entities) {
    const entityWords = entity.toLowerCase().split(' ');
    const entityCodes = entityWords.map(soundex);
    
    // Check if all input codes match entity codes
    let allMatch = true;
    for (let i = 0; i < inputCodes.length; i++) {
      if (!entityCodes.includes(inputCodes[i])) {
        allMatch = false;
        break;
      }
    }
    
    if (allMatch) {
      return {
        matched: entity,
        confidence: 0.95,
        matchType: 'phonetic',
      };
    }
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}

// Examples:
// soundex("John") → "J500"
// soundex("Jon") → "J500"
// phoneticMatch("jon", ["John Smith"]) → matched: "John Smith", confidence: 0.95
// phoneticMatch("yosi", ["Yossi Cohen"]) → matched: "Yossi Cohen", confidence: 0.95
```

### 3.2 Metaphone (Alternative)
```typescript
// lib/matching/metaphone.ts

// Using the 'metaphone' npm package
import { metaphone } from 'metaphone';

export function metaphoneMatch(
  input: string,
  entities: string[]
): MatchResult {
  const inputCode = metaphone(input);
  
  for (const entity of entities) {
    const entityCode = metaphone(entity);
    
    if (inputCode === entityCode) {
      return {
        matched: entity,
        confidence: 0.95,
        matchType: 'phonetic',
      };
    }
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}

// Metaphone is generally more accurate than Soundex for English
// Install: npm install metaphone
```

---

## 4. Level 3: Levenshtein Distance

### 4.1 Implementation
```typescript
// lib/matching/fuzzy-match.ts

/**
 * Calculate Levenshtein distance between two strings
 * (minimum number of edits to transform one string into another)
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Fuzzy matching using Levenshtein distance
 */
export function fuzzyMatch(
  input: string,
  entities: string[],
  threshold: number = 2
): MatchResult {
  const normalized = input.toLowerCase().trim();
  
  let bestMatch: string | null = null;
  let bestDistance = Infinity;
  
  for (const entity of entities) {
    const entityNorm = entity.toLowerCase().trim();
    const distance = levenshteinDistance(normalized, entityNorm);
    
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = entity;
    }
  }
  
  if (bestMatch && bestDistance <= threshold) {
    // Calculate confidence based on distance
    // distance 0 → confidence 1.0
    // distance 1 → confidence 0.95
    // distance 2 → confidence 0.90
    const confidence = 1.0 - (bestDistance * 0.05);
    
    return {
      matched: bestMatch,
      confidence,
      matchType: 'fuzzy',
    };
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}

// Examples:
// levenshteinDistance("john", "jon") → 1
// levenshteinDistance("michael", "micheal") → 1
// fuzzyMatch("micheal", ["Michael Smith"], 2) → matched: "Michael Smith", confidence: 0.95
```

### 4.2 Optimized Implementation
```typescript
// lib/matching/fuzzy-match-optimized.ts

// Using fastest-levenshtein for better performance
import { distance } from 'fastest-levenshtein';

export function fuzzyMatchOptimized(
  input: string,
  entities: string[],
  threshold: number = 2
): MatchResult {
  const normalized = input.toLowerCase().trim();
  
  const candidates = entities
    .map((entity) => ({
      entity,
      distance: distance(normalized, entity.toLowerCase().trim()),
    }))
    .filter((c) => c.distance <= threshold)
    .sort((a, b) => a.distance - b.distance);
  
  if (candidates.length > 0) {
    const best = candidates[0];
    const confidence = 1.0 - (best.distance * 0.05);
    
    return {
      matched: best.entity,
      confidence,
      matchType: 'fuzzy',
      candidates: candidates.slice(1, 4).map((c) => ({
        entity: c.entity,
        score: 1.0 - (c.distance * 0.05),
      })),
    };
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}

// Install: npm install fastest-levenshtein
```

---

## 5. Level 4: LLM Semantic Match

### 5.1 Implementation
```typescript
// lib/matching/semantic-match.ts

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function semanticMatch(
  input: string,
  entities: string[]
): Promise<MatchResult> {
  const prompt = `
You are a name matching assistant.

Given input: "${input}"
Available entities: ${JSON.stringify(entities)}

Task: Find the best match for the input among the available entities.

Consider:
- Nicknames (e.g., "Mike" → "Michael", "Jon" → "Jonathan")
- Partial names (e.g., "Smith" → "John Smith")
- Phonetic similarity (e.g., "Yosi" → "Yossi")
- Typos and misspellings

Respond ONLY in JSON:
{
  "matched": "Entity Name" or null,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}

If no good match (confidence < 0.7), return null.
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    
    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }
    
    const result = JSON.parse(content);
    
    return {
      matched: result.matched,
      confidence: result.confidence,
      matchType: 'semantic',
    };
  } catch (error) {
    console.error('Semantic match error:', error);
    return {
      matched: null,
      confidence: 0,
      matchType: 'none',
    };
  }
}

// Examples:
// semanticMatch("Mike", ["Michael Smith"]) → matched: "Michael Smith", confidence: 0.88
// semanticMatch("Jon", ["John Doe", "Jonathan Smith"]) → may be ambiguous
```

---

## 6. Unified Matching Function

### 6.1 Cascading Matcher
```typescript
// lib/matching/matcher.ts

import { exactMatch } from './exact-match';
import { phoneticMatch } from './phonetic-match';
import { fuzzyMatchOptimized } from './fuzzy-match-optimized';
import { semanticMatch } from './semantic-match';

export interface MatchConfig {
  usePhonetic?: boolean;      // Default: true
  useFuzzy?: boolean;          // Default: true
  useSemantic?: boolean;       // Default: true
  fuzzyThreshold?: number;     // Default: 2
  semanticThreshold?: number;  // Default: 0.7
}

/**
 * Unified matching function with cascading strategy
 */
export async function match(
  input: string,
  entities: string[],
  config: MatchConfig = {}
): Promise<MatchResult> {
  const {
    usePhonetic = true,
    useFuzzy = true,
    useSemantic = true,
    fuzzyThreshold = 2,
    semanticThreshold = 0.7,
  } = config;
  
  // LEVEL 1: Exact match
  const exactResult = exactMatch(input, entities);
  if (exactResult.matched) {
    return exactResult;
  }
  
  // LEVEL 2: Phonetic match
  if (usePhonetic) {
    const phoneticResult = phoneticMatch(input, entities);
    if (phoneticResult.matched) {
      return phoneticResult;
    }
  }
  
  // LEVEL 3: Fuzzy match
  if (useFuzzy) {
    const fuzzyResult = fuzzyMatchOptimized(input, entities, fuzzyThreshold);
    if (fuzzyResult.matched && fuzzyResult.confidence >= 0.85) {
      return fuzzyResult;
    }
  }
  
  // LEVEL 4: Semantic match (LLM)
  if (useSemantic) {
    const semanticResult = await semanticMatch(input, entities);
    if (semanticResult.matched && semanticResult.confidence >= semanticThreshold) {
      return semanticResult;
    }
  }
  
  // No match found
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}
```

### 6.2 Usage Example
```typescript
// app/api/parse/route.ts

import { match } from '@/lib/matching/matcher';

export async function POST(req: Request) {
  const { transcript, tableSchema } = await req.json();
  
  // Extract entity from transcript (e.g., "john smith, 85")
  const entityInput = transcript.split(',')[0].trim();
  
  // Get available entities
  const entities = tableSchema.rows.map((r: any) => r.label);
  
  // Match
  const matchResult = await match(entityInput, entities);
  
  if (matchResult.matched) {
    return Response.json({
      entity: matchResult.matched,
      confidence: matchResult.confidence,
      matchType: matchResult.matchType,
    });
  } else {
    return Response.json({
      error: 'No match found',
      candidates: matchResult.candidates,
    });
  }
}
```

---

## 7. Partial Name Matching

### 7.1 First Name Only
```typescript
// lib/matching/partial-match.ts

/**
 * Match by first name only
 * Input: "john" → Matches: "John Smith", "John Doe"
 */
export function matchFirstName(
  input: string,
  entities: string[]
): MatchResult {
  const inputLower = input.toLowerCase().trim();
  
  const matches = entities.filter((entity) => {
    const firstName = entity.split(' ')[0].toLowerCase();
    return firstName === inputLower;
  });
  
  if (matches.length === 1) {
    // Unique match
    return {
      matched: matches[0],
      confidence: 0.9,
      matchType: 'fuzzy',
    };
  } else if (matches.length > 1) {
    // Ambiguous
    return {
      matched: null,
      confidence: 0,
      matchType: 'none',
      candidates: matches.map((m) => ({ entity: m, score: 0.9 })),
    };
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}
```

### 7.2 Last Name Only
```typescript
/**
 * Match by last name only
 * Input: "smith" → Matches: "John Smith", "Sarah Smith"
 */
export function matchLastName(
  input: string,
  entities: string[]
): MatchResult {
  const inputLower = input.toLowerCase().trim();
  
  const matches = entities.filter((entity) => {
    const parts = entity.split(' ');
    const lastName = parts[parts.length - 1].toLowerCase();
    return lastName === inputLower;
  });
  
  if (matches.length === 1) {
    return {
      matched: matches[0],
      confidence: 0.85, // Lower than first name
      matchType: 'fuzzy',
    };
  } else if (matches.length > 1) {
    return {
      matched: null,
      confidence: 0,
      matchType: 'none',
      candidates: matches.map((m) => ({ entity: m, score: 0.85 })),
    };
  }
  
  return {
    matched: null,
    confidence: 0,
    matchType: 'none',
  };
}
```

---

## 8. Ambiguity Resolution

### 8.1 Detecting Ambiguity
```typescript
// lib/matching/ambiguity.ts

export interface AmbiguityResult {
  isAmbiguous: boolean;
  candidates: Array<{
    entity: string;
    confidence: number;
  }>;
  recommendedAction: 'auto_select' | 'ask_user' | 'create_new';
}

export function detectAmbiguity(
  matchResult: MatchResult,
  threshold: number = 0.85
): AmbiguityResult {
  // High confidence match → auto-select
  if (matchResult.matched && matchResult.confidence >= threshold) {
    return {
      isAmbiguous: false,
      candidates: [{ entity: matchResult.matched, confidence: matchResult.confidence }],
      recommendedAction: 'auto_select',
    };
  }
  
  // Multiple candidates with similar scores → ask user
  if (matchResult.candidates && matchResult.candidates.length > 1) {
    const topScore = matchResult.candidates[0].score;
    const similarCandidates = matchResult.candidates.filter(
      (c) => topScore - c.score < 0.1 // Within 10% of top score
    );
    
    if (similarCandidates.length > 1) {
      return {
        isAmbiguous: true,
        candidates: similarCandidates,
        recommendedAction: 'ask_user',
      };
    }
  }
  
  // Low confidence match → create new?
  if (matchResult.matched && matchResult.confidence < 0.7) {
    return {
      isAmbiguous: true,
      candidates: matchResult.candidates || [],
      recommendedAction: 'create_new',
    };
  }
  
  // No match at all → create new
  if (!matchResult.matched) {
    return {
      isAmbiguous: false,
      candidates: [],
      recommendedAction: 'create_new',
    };
  }
  
  // Default: ask user
  return {
    isAmbiguous: true,
    candidates: matchResult.candidates || [],
    recommendedAction: 'ask_user',
  };
}
```

### 8.2 User Disambiguation UI
```typescript
// components/DisambiguationDialog.tsx

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DisambiguationDialogProps {
  open: boolean;
  input: string;
  candidates: Array<{ entity: string; confidence: number }>;
  onSelect: (entity: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export function DisambiguationDialog({
  open,
  input,
  candidates,
  onSelect,
  onCreateNew,
  onCancel,
}: DisambiguationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Which did you mean?</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            You said: <strong>"{input}"</strong>
          </p>
          
          <div className="space-y-2 mt-4">
            {candidates.map((candidate, index) => (
              <Button
                key={candidate.entity}
                variant="outline"
                className="w-full justify-between"
                onClick={() => onSelect(candidate.entity)}
              >
                <span>{candidate.entity}</span>
                <span className="text-xs text-gray-500">
                  {Math.round(candidate.confidence * 100)}% match
                </span>
              </Button>
            ))}
            
            <Button
              variant="secondary"
              className="w-full"
              onClick={onCreateNew}
            >
              Create new: "{input}"
            </Button>
            
            <Button
              variant="ghost"
              className="w-full"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 9. Performance Optimization

### 9.1 Caching
```typescript
// lib/matching/cache.ts

import { LRUCache } from 'lru-cache';

interface CacheKey {
  input: string;
  entities: string;
}

const matchCache = new LRUCache<string, MatchResult>({
  max: 500, // Cache up to 500 results
  ttl: 1000 * 60 * 5, // 5 minutes
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

// Usage in matcher:
export async function matchWithCache(
  input: string,
  entities: string[]
): Promise<MatchResult> {
  // Check cache first
  const cached = getCachedMatch(input, entities);
  if (cached) {
    return cached;
  }
  
  // Perform match
  const result = await match(input, entities);
  
  // Cache result
  setCachedMatch(input, entities, result);
  
  return result;
}
```

### 9.2 Early Termination
```typescript
// lib/matching/early-termination.ts

/**
 * Skip expensive matching steps if entity count is small
 */
export async function matchWithEarlyTermination(
  input: string,
  entities: string[]
): Promise<MatchResult> {
  // For very small entity sets, just use exact + fuzzy
  if (entities.length <= 5) {
    const exact = exactMatch(input, entities);
    if (exact.matched) return exact;
    
    const fuzzy = fuzzyMatchOptimized(input, entities);
    if (fuzzy.matched) return fuzzy;
    
    // Skip LLM for small sets
    return {
      matched: null,
      confidence: 0,
      matchType: 'none',
    };
  }
  
  // For large entity sets, use full cascade
  return match(input, entities);
}
```

---

## 10. Testing

### 10.1 Unit Tests
```typescript
// tests/matching.test.ts

import { describe, it, expect } from 'vitest';
import { exactMatch, phoneticMatch, fuzzyMatchOptimized } from '@/lib/matching';

const mockEntities = [
  'John Smith',
  'Jonathan Smith',
  'Joan Rivers',
  'Michael Brown',
  'Yossi Cohen',
];

describe('Exact Match', () => {
  it('should match exact strings (case-insensitive)', () => {
    const result = exactMatch('john smith', mockEntities);
    expect(result.matched).toBe('John Smith');
    expect(result.confidence).toBe(1.0);
  });
  
  it('should handle extra whitespace', () => {
    const result = exactMatch('  JOHN  SMITH  ', mockEntities);
    expect(result.matched).toBe('John Smith');
  });
});

describe('Phonetic Match', () => {
  it('should match phonetically similar names', () => {
    const result = phoneticMatch('jon smith', mockEntities);
    expect(result.matched).toBe('John Smith');
    expect(result.confidence).toBeGreaterThan(0.9);
  });
  
  it('should match Hebrew phonetics', () => {
    const result = phoneticMatch('yosi cohen', mockEntities);
    expect(result.matched).toBe('Yossi Cohen');
  });
});

describe('Fuzzy Match', () => {
  it('should match with small typos', () => {
    const result = fuzzyMatchOptimized('micheal', ['Michael Brown']);
    expect(result.matched).toBe('Michael Brown');
    expect(result.confidence).toBeGreaterThan(0.9);
  });
  
  it('should not match beyond threshold', () => {
    const result = fuzzyMatchOptimized('xyz', mockEntities, 2);
    expect(result.matched).toBeNull();
  });
});
```

### 10.2 Integration Tests
```typescript
// tests/matching-integration.test.ts

import { describe, it, expect } from 'vitest';
import { match } from '@/lib/matching/matcher';

describe('Cascading Matcher', () => {
  it('should prefer exact match over phonetic', async () => {
    const entities = ['John Smith', 'Jon Smith'];
    const result = await match('john smith', entities);
    
    expect(result.matched).toBe('John Smith');
    expect(result.matchType).toBe('exact');
  });
  
  it('should fall back to fuzzy if no exact match', async () => {
    const entities = ['Michael Brown'];
    const result = await match('micheal', entities, { useSemantic: false });
    
    expect(result.matched).toBe('Michael Brown');
    expect(result.matchType).toBe('fuzzy');
  });
  
  it('should return candidates for ambiguous matches', async () => {
    const entities = ['John Smith', 'Jonathan Smith'];
    const result = await match('jon', entities, { useSemantic: false });
    
    // Should be ambiguous between the two
    if (result.candidates) {
      expect(result.candidates.length).toBeGreaterThan(0);
    }
  });
});
```

---

## 11. Matching Engine Checklist

**Implementation:**
- [ ] Exact match algorithm
- [ ] Phonetic match (Soundex or Metaphone)
- [ ] Fuzzy match (Levenshtein)
- [ ] LLM semantic match
- [ ] Cascading strategy
- [ ] Ambiguity detection
- [ ] User disambiguation UI
- [ ] Caching layer

**Testing:**
- [ ] Test exact matches
- [ ] Test phonetic matches
- [ ] Test fuzzy matches
- [ ] Test ambiguous cases
- [ ] Test edge cases (empty input, no entities)
- [ ] Performance benchmarks

**Performance:**
- [ ] Measure latency for each level
- [ ] Ensure total matching time < 50ms (non-LLM)
- [ ] Cache frequently matched entities
- [ ] Early termination for small datasets

---

*End of Matching Engine Documentation*