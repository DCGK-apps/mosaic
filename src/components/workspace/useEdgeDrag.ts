import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { beginEdgeDrag, cellEdge, dragFrac, type EdgeDrag, type Junction } from '../../core/edges';
import type { CellBox, Layout } from '../../core/geometry';
import { isolateSegment, joinLine } from '../../core/restructure';
import type { Dir, Node, Sheet } from '../../core/types';
import type { Mosaic } from '../../hooks/useMosaic';

/** Grab area of an edge in screen pixels (also when the frame is thin or 0). */
export const HIT_PX = 16;
/** An edge snaps to another one in line with it from this distance (Shift: no snapping). */
const SNAP_PX = 8;
/** At a crossing the first movement tells which edge is meant. */
const DIRECTION_SLOP_PX = 4;
/** Movement below this is still a click. */
const MOVE_SLOP_PX = 2;

interface Params {
  tree: Node | null;
  sheet: Sheet;
  layout: Layout;
  /** Screen pixels per millimetre. */
  scale: number;
  sheetRef: RefObject<HTMLDivElement | null>;
  act: Mosaic['act'];
  endGesture: () => void;
}

/**
 * Dragging edges. Two ways to grab:
 * - an edge (cursor ↔ / ↕): only that part moves – a line crossed by another
 *   one is cut there first (isolateSegment), so the shortest piece moves;
 * - a crossing (knob, cursor ✥): the first movement picks the line
 *   (sideways → the vertical one, up/down → the horizontal one) and the whole
 *   line moves – parts in line with each other are joined first (joinLine).
 * - a photo, with the "Układ" tool: the movement picks the axis and the
 *   photo's edge nearer to the finger moves (only that part, as above).
 * Cells never collapse, edges snap into line with others; one drag = one undo step.
 */
export function useEdgeDrag(params: Params): {
  active: string | null;
  onGrabEdge: (splitId: string, e: ReactPointerEvent) => void;
  onGrabJunction: (j: Junction, e: ReactPointerEvent) => void;
  onGrabCell: (cell: CellBox, e: ReactPointerEvent) => void;
} {
  const latest = useRef(params);
  useLayoutEffect(() => {
    latest.current = params;
  });
  const [active, setActive] = useState<string | null>(null);

  /** `pick` chooses the edge once the direction of the movement is known (null: not yet). */
  const start = useCallback((e: ReactPointerEvent, pick: (dir: Dir | null, at: { x: number; y: number }) => string | null, mode: 'part' | 'line') => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const { scale, sheetRef } = latest.current;
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect || scale <= 0) return;
    const at = { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    const pointerId = e.pointerId;
    const origin = { x: e.clientX, y: e.clientY };
    let chosen = pick(null, at);
    let drag: EdgeDrag | null = null;
    if (chosen) setActive(chosen);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - origin.x;
      const dy = ev.clientY - origin.y;
      if (!chosen) {
        if (Math.hypot(dx, dy) < DIRECTION_SLOP_PX) return;
        chosen = pick(Math.abs(dx) >= Math.abs(dy) ? 'V' : 'H', at);
        if (!chosen) return;
        setActive(chosen);
      }
      const { tree, sheet, scale: s, act } = latest.current;
      if (!drag) {
        if (!tree) return;
        // Same picture, rebuilt so that the grabbed part (or the whole line) is one edge.
        const next = mode === 'part' ? isolateSegment(tree, sheet, chosen, at) : joinLine(tree, sheet, chosen);
        const dir = beginEdgeDrag(next, sheet, chosen)?.dir;
        if (!dir || Math.abs(dir === 'V' ? dx : dy) < MOVE_SLOP_PX) return;
        if (next !== tree) act(mode === 'part' ? { type: 'isolate', splitId: chosen, x: at.x, y: at.y } : { type: 'joinLine', splitId: chosen }, { transient: true });
        drag = beginEdgeDrag(next, sheet, chosen);
        if (!drag) return;
      }
      const frac = dragFrac(drag, (drag.dir === 'V' ? dx : dy) / s, ev.shiftKey ? 0 : SNAP_PX / s);
      act({ type: 'setFrac', splitId: drag.splitId, frac }, { transient: true });
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      setActive(null);
      latest.current.endGesture();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }, []);

  const onGrabEdge = useCallback((splitId: string, e: ReactPointerEvent) => start(e, () => splitId, 'part'), [start]);
  const onGrabJunction = useCallback(
    (j: Junction, e: ReactPointerEvent) => start(e, (dir) => (dir === 'V' ? j.vertical[0] : dir === 'H' ? j.horizontal[0] : null) ?? null, 'line'),
    [start],
  );
  const onGrabCell = useCallback(
    (cell: CellBox, e: ReactPointerEvent) =>
      start(
        e,
        (dir, at) => {
          if (!dir) return null;
          const d = cellEdge(latest.current.layout, cell, dir, at);
          if (!d) return null;
          // Cut the edge where it borders this photo: the point on the edge next to the finger.
          at.x = dir === 'V' ? d.x + d.w / 2 : Math.min(cell.x + cell.w, Math.max(cell.x, at.x));
          at.y = dir === 'H' ? d.y + d.h / 2 : Math.min(cell.y + cell.h, Math.max(cell.y, at.y));
          return d.splitId;
        },
        'part',
      ),
    [start],
  );
  return { active, onGrabEdge, onGrabJunction, onGrabCell };
}
