/**
 * Waveform Component
 * Real amplitude-driven bar visualization for the voice orb.
 * Visual pattern ported from docs/design/src/App.tsx's `Waveform`, with one
 * deliberate change: the design file's bars are purely CSS-animated and
 * ignore real amplitude. These bars scale with `level` so silence visibly
 * collapses them — the previous single-bar meter floored width at 40%,
 * making "mic dead" and "hearing you" look identical.
 * Based on: docs/features/15_realtime_voice_feedback.md §3.4
 */

'use client';

import React from 'react';

const FOREST = '#13501B';
const IDLE = '#d1fae5';

// Relative bar heights at full amplitude — same silhouette as the design file.
const BAR_HEIGHTS = [0.4, 0.7, 1, 0.8, 0.55, 0.9, 0.65, 1, 0.5, 0.75, 0.85, 0.45, 0.7, 0.95, 0.6];

interface WaveformProps {
  /** Current audio level, clamped to [0, 1] — drives real bar height. */
  level: number;
  /** Whether recording is active — gates color and the per-bar CSS animation. */
  active: boolean;
}

export const Waveform = React.memo(function Waveform({ level, active }: WaveformProps): React.JSX.Element {
  const clampedLevel = Math.max(0, Math.min(1, level));
  // Floor at a small, non-zero amount only so bars never fully vanish while
  // active (a hairline is still visibly "on") — unlike the old 40% floor,
  // this is barely perceptible and does not mask silence.
  const amplitude = active ? Math.max(0.05, clampedLevel) : 0;

  return (
    <div className="flex items-center gap-[3px] h-8" aria-hidden="true">
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${h * amplitude * 100}%`,
            minHeight: active ? 2 : 0,
            borderRadius: 2,
            background: active ? FOREST : IDLE,
            transformOrigin: 'center',
            animation: active
              ? `wave-bar ${0.6 + (i % 4) * 0.15}s ease-in-out ${i * 0.06}s infinite`
              : 'none',
            transition: 'height 0.1s ease-out, background 0.3s',
          }}
        />
      ))}
    </div>
  );
});
