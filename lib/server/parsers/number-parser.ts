// lib/parsers/number-parser.ts
import { normalizeText } from './text-normalizer';

const EN = {
  units: { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19 },
  tens:  { twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 },
  scales:{ hundred:100, thousand:1000, million:1000000 }
};

const HE = {
  units: { 'אפס':0, 'אחת':1, 'אחד':1, 'שתיים':2, 'שניים':2, 'שלוש':3, 'שלושה':3, 'ארבע':4, 'ארבעה':4, 'חמש':5, 'חמישה':5, 'שש':6, 'שישה':6, 'שבע':7, 'שבעה':7, 'שמונה':8, 'תשע':9, 'תשעה':9, 'עשר':10, 'עשרה':10 },
  teens: { 'אחת עשרה':11, 'אחד עשר':11, 'שתים עשרה':12, 'שנים עשר':12, 'שלוש עשרה':13, 'שלושה עשר':13, 'ארבע עשרה':14, 'ארבעה עשר':14, 'חמש עשרה':15, 'חמישה עשר':15, 'שש עשרה':16, 'שישה עשר':16, 'שבע עשרה':17, 'שבעה עשר':17, 'שמונה עשרה':18, 'שמונה עשר':18, 'תשע עשרה':19, 'תשעה עשר':19 },
  tens:  { 'עשרים':20, 'שלושים':30, 'ארבעים':40, 'חמישים':50, 'שישיים':60, 'שישים':60, 'שבעים':70, 'שמונים':80, 'תשעים':90 },
  scales:{ 'מאה':100, 'מאתיים':200, 'מאות':100, 'אלף':1000, 'אלפיין':1000, 'אלפיים':2000, 'אלפים':1000 }
};

export function parseSpokenNumber(input: string, lang: 'he' | 'en' | 'auto' = 'auto'): number | null {
  const cleaned = normalizeText(input).toLowerCase();
  
  // 1. Try direct parsing if it's a number (like "156" or "156.5") - common path from Whisper
  const parsedFloat = parseFloat(cleaned.replace(/,/g, ''));
  if (!isNaN(parsedFloat) && String(parsedFloat) === cleaned.replace(/,/g, '')) {
    return parsedFloat;
  }

  // 2. Tokenize and remove 'ו' (e.g. "חמישים ושש" -> "חמישים", "שש")
  const rawTokens = cleaned.split(/[\s-]+/);
  const tokens: string[] = [];
  
  for (const token of rawTokens) {
    if (lang !== 'en' && token.startsWith('ו') && token.length > 2) {
      tokens.push(token.substring(1)); // Remove 'ו' addition
    } else {
      tokens.push(token);
    }
  }

  let total = 0;
  let current = 0;
  let hasValidWords = false;

  // 3. Two-step parsing (support for compound expressions like "שלוש עשרה")
  for (let i = 0; i < tokens.length; i++) {
    const currentToken = tokens[i];
    const nextToken = tokens[i + 1];
    const twoWordCombo = nextToken ? `${currentToken} ${nextToken}` : null;

    // Check for two-word numbers (e.g. "אחת עשרה" or "שלוש עשרה")
    if (twoWordCombo && twoWordCombo in HE.teens) {
      current += HE.teens[twoWordCombo as keyof typeof HE.teens];
      hasValidWords = true;
      i++; // Skip the next word
      continue;
    }

    // Regular parsing for single words
    let val: number | null = null;
    let isScale = false;

    if (currentToken in EN.units) val = EN.units[currentToken as keyof typeof EN.units];
    else if (currentToken in EN.tens) val = EN.tens[currentToken as keyof typeof EN.tens];
    else if (currentToken in EN.scales) { val = EN.scales[currentToken as keyof typeof EN.scales]; isScale = true; }
    else if (currentToken in HE.units) val = HE.units[currentToken as keyof typeof HE.units];
    else if (currentToken in HE.tens) val = HE.tens[currentToken as keyof typeof HE.tens];
    else if (currentToken in HE.scales) { val = HE.scales[currentToken as keyof typeof HE.scales]; isScale = true; }

    if (val !== null) {
      hasValidWords = true;
      if (isScale) {
        if (val === 100 || val === 1000) {
          current = (current || 1) * val;
        } else if (val === 200 || val === 2000) { // Even scale numbers (100/1000)
          total += val;
          current = 0;
        } else {
          total += (current || 1) * val;
          current = 0;
        }
      } else {
        current += val;
      }
    }
  }

  if (hasValidWords) {
    return total + current;
  }

  // Fallback for mixed number/word sentences ("156 שקלים")
  const digitMatch = cleaned.match(/\d+(?:\.\d+)?/);
  if (digitMatch) {
    return parseFloat(digitMatch[0]);
  }

  return null;
}