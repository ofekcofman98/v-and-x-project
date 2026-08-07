import { describe, it, expect } from 'vitest';
import { decideChunkFlush } from './vad-chunking';

const thresholds = {
  maxChunkMs: 15_000,
  hardMaxChunkMs: 30_000,
  silenceDurationMs: 700,
  overflowSilenceMs: 250,
};

describe('decideChunkFlush', () => {
  it('keeps recording while speaking under the soft cap', () => {
    expect(
      decideChunkFlush({ chunkElapsedMs: 5000, silenceElapsedMs: null }, thresholds)
    ).toBeNull();
  });

  it('flushes for "silence" once the normal silence window elapses under the soft cap', () => {
    expect(
      decideChunkFlush({ chunkElapsedMs: 5000, silenceElapsedMs: 699 }, thresholds)
    ).toBeNull();
    expect(
      decideChunkFlush({ chunkElapsedMs: 5000, silenceElapsedMs: 700 }, thresholds)
    ).toBe('silence');
  });

  it('does not flush at exactly maxChunkMs while the user keeps speaking (no silence detected)', () => {
    // This is the original bug: cutting off at a fixed cap regardless of
    // whether the user paused, mid-word if necessary.
    expect(
      decideChunkFlush({ chunkElapsedMs: 15_000, silenceElapsedMs: null }, thresholds)
    ).toBeNull();
    expect(
      decideChunkFlush({ chunkElapsedMs: 20_000, silenceElapsedMs: null }, thresholds)
    ).toBeNull();
  });

  it('flushes for "overflow" at the next brief pause once past the soft cap', () => {
    expect(
      decideChunkFlush({ chunkElapsedMs: 15_100, silenceElapsedMs: 200 }, thresholds)
    ).toBeNull();
    expect(
      decideChunkFlush({ chunkElapsedMs: 15_100, silenceElapsedMs: 250 }, thresholds)
    ).toBe('overflow');
  });

  it('uses the shrunk overflow silence window, not the normal one, once past the soft cap', () => {
    // 300ms of silence would not have flushed a normal (under-cap) chunk
    // (needs 700ms) but does flush an overflowing one (needs only 250ms).
    expect(
      decideChunkFlush({ chunkElapsedMs: 15_050, silenceElapsedMs: 300 }, thresholds)
    ).toBe('overflow');
  });

  it('force-flushes at the hard ceiling even with no silence detected at all', () => {
    expect(
      decideChunkFlush({ chunkElapsedMs: 30_000, silenceElapsedMs: null }, thresholds)
    ).toBe('overflow');
  });

  it('hard ceiling wins even if the chunk is also mid-pause under the overflow window', () => {
    expect(
      decideChunkFlush({ chunkElapsedMs: 30_000, silenceElapsedMs: 10 }, thresholds)
    ).toBe('overflow');
  });

  it('never flushes for "silence" once past the soft cap — always "overflow" or null', () => {
    const result = decideChunkFlush(
      { chunkElapsedMs: 16_000, silenceElapsedMs: 260 },
      thresholds
    );
    expect(result).not.toBe('silence');
    expect(result).toBe('overflow');
  });
});
