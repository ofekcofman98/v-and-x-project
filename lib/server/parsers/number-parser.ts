import { normalizeText } from './text-normalizer';

/**
 * Bilingual spoken-number parser (EN + HE).
 * docs/features/10_voice-pipeline-hardening.md §4.2
 *
 * Bug fixed here: the old implementation was purely additive with no
 * hundred/thousand multiplier logic ("one hundred fifty six" → 57, i.e.
 * 1 + 50 + 6). This is the standard accumulator algorithm: scale words
 * multiply the running `current` group instead of adding to it.
 */

const EN_UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};

const EN_TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

const EN_SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
};

// Both gender forms are valid speech ("שלוש" / "שלושה") — map both.
const HE_UNITS: Record<string, number> = {
  'אפס': 0,
  'אחת': 1, 'אחד': 1,
  'שתיים': 2, 'שניים': 2,
  'שלוש': 3, 'שלושה': 3,
  'ארבע': 4, 'ארבעה': 4,
  'חמש': 5, 'חמישה': 5,
  'שש': 6, 'שישה': 6,
  'שבע': 7, 'שבעה': 7,
  'שמונה': 8,
  'תשע': 9, 'תשעה': 9,
  'עשר': 10, 'עשרה': 10,
};

// Two-word compounds ("שלוש עשרה" = 13) — checked via lookahead before
// falling back to single-token lookup.
const HE_TEENS: Record<string, number> = {
  'אחת עשרה': 11, 'אחד עשר': 11,
  'שתים עשרה': 12, 'שנים עשר': 12,
  'שלוש עשרה': 13, 'שלושה עשר': 13,
  'ארבע עשרה': 14, 'ארבעה עשר': 14,
  'חמש עשרה': 15, 'חמישה עשר': 15,
  'שש עשרה': 16, 'שישה עשר': 16,
  'שבע עשרה': 17, 'שבעה עשר': 17,
  'שמונה עשרה': 18, 'שמונה עשר': 18,
  'תשע עשרה': 19, 'תשעה עשר': 19,
};

const HE_TENS: Record<string, number> = {
  'עשרים': 20, 'שלושים': 30, 'ארבעים': 40, 'חמישים': 50,
  'שישים': 60, 'שבעים': 70, 'שמונים': 80, 'תשעים': 90,
};

// מאתיים/אלפיים are irregular single words for 200/2000 — added directly
// to the total rather than treated as a "current × scale" multiplier.
const HE_IRREGULAR_SCALES: Record<string, number> = {
  'מאתיים': 200,
  'אלפיים': 2_000,
};

// מאה (100) and אלף (1000) multiply the current group; "שלוש מאות" (3×100)
// uses the plural "מאות" form as the same multiplier.
const HE_SCALES: Record<string, number> = {
  'מאה': 100,
  'מאות': 100,
  'אלף': 1_000,
  'אלפים': 1_000,
};

const DECIMAL_MARKERS = new Set(['point', 'נקודה']);

/**
 * Parses a spoken number in English or Hebrew, or a digit string.
 * "one hundred fifty six" → 156, "מאה חמישים ושש" → 156, "85" → 85.
 */
export function parseSpokenNumber(input: string, lang: 'he' | 'en' | 'auto' = 'auto'): number | null {
  const cleaned = normalizeText(input).toLowerCase();

  // Digit fallback fast-path: Whisper usually already emits digits.
  const bareDigits = cleaned.replace(/,/g, '');
  if (bareDigits.length > 0 && !Number.isNaN(Number(bareDigits))) {
    return Number(bareDigits);
  }

  const [wholePart, fractionPart] = splitOnDecimalMarker(cleaned);

  const whole = parseWordGroup(wholePart, lang);
  if (whole === null) {
    // No recognizable words at all — last-resort digit extraction, e.g.
    // "156 שקלים" (mixed digits + trailing word).
    const digitMatch = cleaned.match(/\d+(?:\.\d+)?/);
    return digitMatch ? parseFloat(digitMatch[0]) : null;
  }

  if (fractionPart === undefined) return whole;

  const fractionDigits = parseFractionDigits(fractionPart, lang);
  return fractionDigits === null ? whole : Number(`${whole}.${fractionDigits}`);
}

function splitOnDecimalMarker(cleaned: string): [string, string | undefined] {
  const tokens = cleaned.split(/\s+/);
  const markerIndex = tokens.findIndex((t) => DECIMAL_MARKERS.has(t));
  if (markerIndex === -1) return [cleaned, undefined];
  return [tokens.slice(0, markerIndex).join(' '), tokens.slice(markerIndex + 1).join(' ')];
}

/** Reads spoken digits one at a time after a decimal marker: "five" → "5". */
function parseFractionDigits(fractionPart: string, lang: 'he' | 'en' | 'auto'): string | null {
  const digits = tokenize(fractionPart, lang)
    .map((tok) => lookupUnit(tok, lang))
    .filter((v): v is number => v !== null && v <= 9);
  return digits.length > 0 ? digits.join('') : null;
}

function lookupUnit(token: string, lang: 'he' | 'en' | 'auto'): number | null {
  if (lang !== 'he' && token in EN_UNITS) return EN_UNITS[token];
  if (lang !== 'en' && token in HE_UNITS) return HE_UNITS[token];
  return null;
}

function tokenize(input: string, lang: 'he' | 'en' | 'auto'): string[] {
  return input
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((tok) => stripHebrewConjunction(tok, lang));
}

// Strip the conjunction prefix ו־ ("חמישים ושש" → "חמישים", "שש").
function stripHebrewConjunction(token: string, lang: 'he' | 'en' | 'auto'): string {
  if (lang === 'en') return token;
  if (token.startsWith('ו') && token.length > 2) return token.slice(1);
  return token;
}

function parseWordGroup(input: string, lang: 'he' | 'en' | 'auto'): number | null {
  const rawTokens = tokenize(input, lang);
  if (rawTokens.length === 0) return null;

  let total = 0;
  let current = 0;
  let matchedAny = false;

  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];
    const nextTok = rawTokens[i + 1];
    const twoWord = nextTok ? `${tok} ${nextTok}` : null;

    if (lang !== 'en' && twoWord && twoWord in HE_TEENS) {
      current += HE_TEENS[twoWord];
      matchedAny = true;
      i++; // consumed the lookahead token
      continue;
    }

    if (lang !== 'he' && tok in EN_UNITS) {
      current += EN_UNITS[tok];
      matchedAny = true;
      continue;
    }
    if (lang !== 'he' && tok in EN_TENS) {
      current += EN_TENS[tok];
      matchedAny = true;
      continue;
    }
    if (lang !== 'he' && tok in EN_SCALES) {
      current = (current || 1) * EN_SCALES[tok];
      if (EN_SCALES[tok] >= 1_000) {
        total += current;
        current = 0;
      }
      matchedAny = true;
      continue;
    }
    if (lang !== 'en' && tok in HE_UNITS) {
      current += HE_UNITS[tok];
      matchedAny = true;
      continue;
    }
    if (lang !== 'en' && tok in HE_TENS) {
      current += HE_TENS[tok];
      matchedAny = true;
      continue;
    }
    if (lang !== 'en' && tok in HE_IRREGULAR_SCALES) {
      total += HE_IRREGULAR_SCALES[tok];
      matchedAny = true;
      continue;
    }
    if (lang !== 'en' && tok in HE_SCALES) {
      const scale = HE_SCALES[tok];
      current = (current || 1) * scale;
      if (scale >= 1_000) {
        total += current;
        current = 0;
      }
      matchedAny = true;
      continue;
    }
    // Unrecognized filler word ("uh", "אה") — skip.
  }

  return matchedAny ? total + current : null;
}
