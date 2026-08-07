/**
 * Pure chunk-flush decision logic, extracted from use-vad.ts's tick() so the
 * maxChunkMs soft-cap / hardMaxChunkMs hard-ceiling behavior is unit-testable
 * without mocking MediaRecorder/AudioContext (mirrors the existing
 * extraction pattern in use-pointer-keyboard-nav.ts's
 * `resolveKeyboardNavigation`).
 * Based on: docs/05_VOICE_PIPELINE.md §9.2, §9.5
 */

/**
 * `'silence'` — a real pause under the soft cap. The caller keeps its
 * existing trailing-padding behavior and does not restart capture.
 * `'overflow'` — the chunk ran past maxChunkMs (flushed at the next brief
 * pause) or hit hardMaxChunkMs outright (flushed regardless of pause). Both
 * are mid-utterance splits: the caller must restart capture immediately so
 * dictation continues past the split. `null` — keep recording.
 */
export type ChunkFlushReason = 'silence' | 'overflow' | null;

export interface ChunkFlushInputs {
  /** Ms elapsed since the current chunk's recording started. */
  chunkElapsedMs: number;
  /** Ms elapsed since silence was first detected in this chunk, or null if not currently silent. */
  silenceElapsedMs: number | null;
}

export interface ChunkFlushThresholds {
  /** Soft cap: past this, the effective silence-to-flush window shrinks. */
  maxChunkMs: number;
  /** Hard ceiling: force-flush unconditionally, regardless of silence state. */
  hardMaxChunkMs: number;
  /** Normal silence-to-flush window while under the soft cap. */
  silenceDurationMs: number;
  /** Shrunk silence-to-flush window once past the soft cap — short enough to
   *  catch the next brief inter-word pause instead of running to the hard
   *  ceiling. */
  overflowSilenceMs: number;
}

/**
 * Decides whether the current chunk should flush this tick, and why.
 * The hard ceiling always wins outright (mid-word if necessary — it is a
 * last-resort backstop). Below it, a chunk past the soft cap flushes at a
 * much shorter pause than one still under it, so long dictated lists split
 * between entries rather than being cut off entirely or mangled mid-value.
 */
export function decideChunkFlush(
  inputs: ChunkFlushInputs,
  thresholds: ChunkFlushThresholds
): ChunkFlushReason {
  const { chunkElapsedMs, silenceElapsedMs } = inputs;
  const { maxChunkMs, hardMaxChunkMs, silenceDurationMs, overflowSilenceMs } = thresholds;

  if (chunkElapsedMs >= hardMaxChunkMs) return 'overflow';

  if (silenceElapsedMs === null) return null;

  const isPastSoftCap = chunkElapsedMs >= maxChunkMs;
  const effectiveSilenceDurationMs = isPastSoftCap ? overflowSilenceMs : silenceDurationMs;

  if (silenceElapsedMs < effectiveSilenceDurationMs) return null;

  return isPastSoftCap ? 'overflow' : 'silence';
}
