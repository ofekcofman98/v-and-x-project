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
});
