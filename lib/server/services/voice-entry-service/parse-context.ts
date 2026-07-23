import type { ParseContext } from '@/lib/server/parsers/registry';

export function toParseContext(language: string | undefined): ParseContext {
  return { language: language === 'he' || language === 'en' ? language : 'auto' };
}
