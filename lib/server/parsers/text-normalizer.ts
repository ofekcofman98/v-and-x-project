/**
 * Hebrew-aware text normalization shared by every parser, the boolean
 * word-sets, entity cache keys, and pre-embedding text.
 * docs/features/10_voice-pipeline-hardening.md §4.4
 */

const NIQQUD_AND_CANTILLATION = /[֑-ׇ]/g;
const TRAILING_PUNCTUATION = /[.,!?;:״"'׳]+$/g;
const FINAL_LETTERS: Record<string, string> = {
  ך: 'כ',
  ם: 'מ',
  ן: 'נ',
  ף: 'פ',
  ץ: 'צ',
};

/**
 * Display-safe normalization: NFC form, niqqud/cantillation stripped,
 * trailing punctuation removed, whitespace collapsed. Safe to store —
 * does not lowercase or fold letters.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(NIQQUD_AND_CANTILLATION, '')
    .replace(TRAILING_PUNCTUATION, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalization for matching/lookup only (fuzzy, cache keys, boolean sets)
 * — never for stored values. Lowercases and folds Hebrew final letters so
 * STT segmentation quirks (medial vs. final letter) don't break exact
 * membership checks.
 */
export function normalizeForMatching(input: string): string {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c] ?? c);
}
