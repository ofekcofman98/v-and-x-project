/**
 * useResizeDrag Hook
 * Hand-rolled mousedown → mousemove → mouseup drag-delta math shared by the
 * column-width and row-height resize handles — no resize library installed,
 * per .claude/rules/architecture.md "New Libraries" (confirmed with the
 * user for docs/features/20_interactive_grid_selection.md §7).
 */

'use client';

import { useCallback, useRef } from 'react';

interface UseResizeDragOptions {
  /** Size (px) the drag starts from — read fresh on each mousedown, not memoized. */
  getStartSize: () => number;
  /** Floor the dragged size can't go below (columns: 60px, rows: 24px per spec §7). */
  min: number;
  /** Called with the clamped size on every mousemove (live resize) and once more on mouseup. */
  onResize: (sizePx: number) => void;
}

/**
 * Returns a single `onMouseDown` handler for a drag-handle element. Owns its
 * own window-level mousemove/mouseup listeners for the duration of one drag
 * and cleans them up on mouseup — mirrors the single-listener pattern
 * DataTable's drag-select mouseup and usePointerKeyboardNav's keydown
 * listener already use, rather than a listener per handle staying mounted.
 */
export function useResizeDrag({ getStartSize, min, onResize }: UseResizeDragOptions): {
  onMouseDown: (event: React.MouseEvent, axis: 'x' | 'y') => void;
} {
  // Mutable drag-in-progress state — a ref, not React state, so dragging
  // doesn't trigger a re-render on every pixel of mouse movement.
  const dragRef = useRef<{ axis: 'x' | 'y'; startPos: number; startSize: number } | null>(null);

  const onMouseDown = useCallback(
    (event: React.MouseEvent, axis: 'x' | 'y') => {
      // Never let the handle's mousedown also start a cell drag-selection.
      event.preventDefault();
      event.stopPropagation();

      dragRef.current = {
        axis,
        startPos: axis === 'x' ? event.clientX : event.clientY,
        startSize: getStartSize(),
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const currentPos = drag.axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
        const delta = currentPos - drag.startPos;
        onResize(Math.max(min, drag.startSize + delta));
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [getStartSize, min, onResize]
  );

  return { onMouseDown };
}
