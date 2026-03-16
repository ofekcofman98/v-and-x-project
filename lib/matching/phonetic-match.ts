import type { MatchResult } from './exact-match';

/**
 * Soundex algorithm for phonetic matching
 * Maps similar-sounding words to the same code
 */
export function soundex(name: string): string {
  const upper = name.toUpperCase();
  
  let code = upper[0];
  
  const soundexMap: { [key: string]: string } = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };
  
  for (let i = 1; i < upper.length; i++) {
    const char = upper[i];
    const digit = soundexMap[char];
    
    if (digit && digit !== code[code.length - 1]) {
      code += digit;
    }
    
    if (code.length === 4) break;
  }
  
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
