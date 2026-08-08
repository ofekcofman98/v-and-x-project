// ─────────────────────────────────────────────────────────────────────────────
// Fast-path regex extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts to extract entity + value via lightweight regex patterns before
 * falling back to the LLM.
 * Relocated from lib/server/services/voice-entry-service/quick-extract.ts —
 * zero imports, isomorphic. Reused client-side by the provisional voice
 * feedback layer (docs/features/15_realtime_voice_feedback.md §3.3).
 * docs/10_PERFORMANCE.md §4.5
 */
export function extractEntityQuick(
  transcript: string
): { entity: string; value: number | string } | null {
  const PATTERNS: RegExp[] = [
    /^(.+?),\s*(\d+\.?\d*)$/,  // "Student A, 84"
    /^(.+?)\s+(\d+\.?\d*)$/,   // "Student A 84"
    /^(.+?),\s*([a-zA-Z]+)$/,  // "Student A, present"
    /^(.+?)\s+([a-zA-Z]+)$/,   // "Student A present"
  ];

  for (const pattern of PATTERNS) {
    const regexMatch = transcript.trim().match(pattern);
    if (regexMatch) {
      const entity = regexMatch[1].trim();
      const rawValue = regexMatch[2];
      const value: number | string = isNaN(Number(rawValue)) ? rawValue : Number(rawValue);
      return { entity, value };
    }
  }

  return null;
}
