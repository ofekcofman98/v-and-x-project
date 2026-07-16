import { normalizeText } from './text-normalizer';

/** Display-safe normalization for free-text columns — never the matching-normalized form. */
export function parseText(input: string): string {
  return normalizeText(input);
}
