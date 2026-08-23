import { describe, expect, it } from 'vitest';
import { parseBoolean } from './boolean-parser';

describe('parseBoolean', () => {
  it('recognizes "here" as true', () => {
    expect(parseBoolean('here')).toBe(true);
  });

  it('recognizes "not here" as false', () => {
    expect(parseBoolean('not here')).toBe(false);
  });

  it('recognizes Hebrew "כאן" as true', () => {
    expect(parseBoolean('כאן')).toBe(true);
  });

  it('recognizes Hebrew "לא כאן" as false', () => {
    expect(parseBoolean('לא כאן')).toBe(false);
  });

  it('returns null for unrecognized input', () => {
    expect(parseBoolean('banana')).toBeNull();
  });

  it('recognizes "not present" as false (negation + polarity token)', () => {
    expect(parseBoolean('not present')).toBe(false);
  });

  it('does NOT resolve "he is not here" — unrecognized filler tokens ("he", "is") bail out to null rather than guess', () => {
    // Deliberately strict: this parser also runs against the FULL transcript
    // in the bare-value fast path (pipeline.ts), so it must not swallow
    // arbitrary sentences containing a polarity word.
    expect(parseBoolean('he is not here')).toBeNull();
  });

  it('does NOT hijack a spoken "Entity, value" utterance as a bare boolean value', () => {
    // Regression guard: "Dan, here" must not resolve to `true` — that would
    // silently discard the entity name "Dan" and let the bare-value fast
    // path (lib/server/services/voice-entry-service/bare-value.ts) write the
    // value onto whatever row is currently active instead of Dan's row.
    expect(parseBoolean('Dan, here')).toBeNull();
    expect(parseBoolean('Dan here')).toBeNull();
    expect(parseBoolean('Yossi, not here')).toBeNull();
  });

  it('recognizes Whisper homophone "hear" as true', () => {
    expect(parseBoolean('hear')).toBe(true);
  });

  it('recognizes "x" as false and "v" as true', () => {
    expect(parseBoolean('x')).toBe(false);
    expect(parseBoolean('v')).toBe(true);
  });

  it('recognizes Hebrew "לא נמצא" is unrecognized (not a listed polarity phrase) but "אינו נוכח" resolves via negator', () => {
    expect(parseBoolean('אינו נוכח')).toBe(false);
  });

  it('returns null when a negator appears with no recognizable polarity token', () => {
    expect(parseBoolean('not banana')).toBeNull();
  });

  it('recognizes "nope" and "yep"', () => {
    expect(parseBoolean('nope')).toBe(false);
    expect(parseBoolean('yep')).toBe(true);
  });
});
