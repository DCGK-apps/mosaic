import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { beginEdgeDrag, distanceTo, dividersAt, dragFrac, type EdgeDrag } from '../../core/edges';
import type { DividerBox, Layout } from '../../core/geometry';
import { isolateSegment } from '../../core/restructure';
import type { Node, Sheet } from '../../core/types';
import type { Mosaic } from '../../hooks/useMosaic';

/** Grab area of an edge in screen pixels (also when the frame is thin or 0). */
export const HIT_PX = 16;
/** An edge snaps to another one in line with it from this distance (Shift: no snapping). */
const SNAP_PX = 8;
/** At a crossing the first movement tells which edge is meant. */
const DIRECTION_SLOP_PX = 4;
/** Movement below this is still a click. */
const MOVE_SLOP_PX = 2;
/** Within this distance from a crossing the whole line moves instead of one part (a finger is less precise). */
const CROSSING_PX = { mouse: 4, touch: 10 };

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

const nearest = (list: DividerBox[], x: number, y: number) =>
  list.reduce<DividerBox | null>((best, d) => (!best || distanceTo(d, x, y) < distanceTo(best, x, y) ? d : best), null);

/**
 * Dragging edges: picks the edge under the pointer (at a crossing, by the
 * direction of the first movement), cuts it at crossings so only the grabbed
 * part moves – or, grabbed at a crossing, joins the parts in line so the whole
 * line moves – keeps cells from collapsing and snaps to edges in line with it.
 * The whole drag is one undo step.
 */
export function useEdgeDrag(params: Params): { active: string | null; onGrab: (e: ReactPointerEvent) => void } {
  const latest = useRef(params);
  useLayoutEffect(() => {
    latest.current = params;
  });
  const [active, setActive] = useState<string | null>(null);

  const onGrab = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const { layout, scale, sheetRef } = latest.current;
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect || scale <= 0) return;
    const at = { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    const cands = dividersAt(layout, at.x, at.y, HIT_PX / 2 / scale);
    if (!cands.length) return;
    const pointerId = e.pointerId;
    const crossingPx = e.pointerType === 'mouse' ? CROSSING_PX.mouse : CROSSING_PX.touch;
    const start = { x: e.clientX, y: e.clientY };
    const ambiguous = new Set(cands.map((c) => c.dir)).size > 1;
    let chosen: DividerBox | null = ambiguous ? null : nearest(cands, at.x, at.y);
    let drag: EdgeDrag | null = null;
    if (chosen) setActive(chosen.splitId);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!chosen) {
        if (Math.hypot(dx, dy) < DIRECTION_SLOP_PX) return;
        const dir = Math.abs(dx) >= Math.abs(dy) ? 'V' : 'H';
        chosen = nearest(
          cands.filter((c) => c.dir === dir),
          at.x,
          at.y,
        );
        if (!chosen) return;
        setActive(chosen.splitId);
      }
      const { tree, sheet, scale: s, act } = latest.current;
      const deltaPx = chosen.dir === 'V' ? dx : dy;
      if (!drag) {
        if (Math.abs(deltaPx) < MOVE_SLOP_PX || !tree) return;
        // Same picture, but the grabbed part of a crossed edge becomes an edge of its own.
        const isolate = { splitId: chosen.splitId, x: at.x, y: at.y, tolMm: crossingPx / s };
        const next = isolateSegment(tree, sheet, isolate.splitId, at, isolate.tolMm);
        if (next !== tree) act({ type: 'isolate', ...isolate }, { transient: true });
        drag = beginEdgeDrag(next, sheet, chosen.splitId);
        if (!drag) return;
      }
      const frac = dragFrac(drag, deltaPx / s, ev.shiftKey ? 0 : SNAP_PX / s);
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

  return { active, onGrab };
}
