import { parse as parseDate } from 'chrono-node';

/**
 * Parses a natural-language date string. chrono-node has no Hebrew locale,
 * so Hebrew date phrases fall through to the LLM fallback — tracked as a
 * known gap, not handled here.
 */
export function parseNaturalDate(input: string): Date | null {
  const results = parseDate(input);
  return results.length > 0 ? results[0].start.date() : null;
}
