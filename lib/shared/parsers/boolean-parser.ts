// lib/shared/parsers/boolean-parser.ts
import { normalizeText } from './text-normalizer';

const TRUE_SET = new Set([
  'yes', 'true', 'present', 'here', 'hear', 'check', 'checked', 'done', 'complete', 'completed', 'correct', '1', 'y',
  'v', 'yep', 'yeah',
  'כן', 'נכון', 'חיובי', 'בוצע', 'הושלם', 'יש', 'נוכח', 'נוכחת', 'כאן', 'אישור', 'וי'
]);

const FALSE_SET = new Set([
  'no', 'false', 'absent', 'not here', 'uncheck', 'unchecked', 'not done', 'incomplete', 'wrong', '0', 'n',
  'x', 'nope',
  'לא', 'שלילי', 'לא בוצע', 'חסר', 'חסרה', 'נעדר', 'נעדרת', 'לא כאן', 'ביטול', 'אין', 'איקס'
]);

// Negation tokens recognized when the whole-string match above misses and we
// fall back to tokenized scanning — e.g. "not present", "he is not here".
const NEGATORS = new Set(["not", "isn't", "isnt", "no", "didn't", "didnt", 'never', 'לא', 'אינו', 'אינה']);

/**
 * Whole-string exact match against TRUE_SET/FALSE_SET, preserving existing
 * behaviour (including multi-word Hebrew entries like "לא בוצע").
 */
function matchWholeString(normalized: string): boolean | null {
  if (TRUE_SET.has(normalized)) return true;
  if (FALSE_SET.has(normalized)) return false;
  return null;
}

/**
 * Tokenized fallback for short negated phrases the whole-string set doesn't
 * enumerate (e.g. "not present"). Every token must be either a recognized
 * negator or a recognized polarity word — a single unrecognized token (a
 * name, filler word, anything not in the vocabulary) bails out to null.
 *
 * This is deliberately strict: this parser also feeds
 * lib/server/services/voice-entry-service/bare-value.ts, which runs it
 * against the FULL transcript of an already-active cell. A loose scan that
 * ignores unrecognized tokens would swallow genuine "Entity, value"
 * utterances (e.g. "Dan, here") as a bare value for the active row,
 * silently discarding the spoken entity name instead of letting the
 * entity-matching stage attribute the write to the right row.
 */
function matchTokenized(normalized: string): boolean | null {
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  let negated = false;
  let polarity: boolean | null = null;

  for (const token of tokens) {
    if (NEGATORS.has(token)) {
      negated = true;
      continue;
    }
    if (TRUE_SET.has(token)) {
      if (polarity !== null) return null; // more than one polarity word — ambiguous, don't guess
      polarity = true;
      continue;
    }
    if (FALSE_SET.has(token)) {
      if (polarity !== null) return null;
      polarity = false;
      continue;
    }
    // Unrecognized token (e.g. a spoken entity name) — this isn't a bare
    // boolean phrase, bail rather than guess.
    return null;
  }

  if (polarity === null) return null;
  return negated ? !polarity : polarity;
}

export function parseBoolean(input: string): boolean | null {
  // Plain normalizeText — not normalizeForMatching. Final-letter folding is
  // for fuzzy/cache-key matching only; it would turn "כן" into "כנ" and
  // silently break exact-set membership here.
  const normalized = normalizeText(input).toLowerCase();

  const whole = matchWholeString(normalized);
  if (whole !== null) return whole;

  return matchTokenized(normalized);
}
