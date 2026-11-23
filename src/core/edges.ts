import { computeLayout, type DividerBox, type Layout } from './geometry';
import type { Dir, Node, Sheet } from './types';

/**
 * Dragging an edge (divider): how far it may go, and where it snaps to.
 * Positions are in mm of the sheet and mean the start of the divider's gap band
 * (its left edge for a vertical divider, its top edge for a horizontal one).
 */

/** No cell gets smaller than this while an edge is dragged (smaller sheets: 6% of the shorter side). */
export function minCellMm(sheet: Pick<Sheet, 'widthMm' | 'heightMm'>): number {
  return Math.min(15, Math.min(sheet.widthMm, sheet.heightMm) * 0.06);
}

/**
 * Smallest size of `node` along `dir` at which every cell inside still has
 * `min` mm – the parts of a split scale proportionally when it shrinks.
 */
export function minExtent(node: Node, dir: Dir, gapMm: number, min: number): number {
  if (node.kind === 'leaf') return min;
  const a = minExtent(node.a, dir, gapMm, min);
  const b = minExtent(node.b, dir, gapMm, min);
  if (node.dir !== dir) return Math.max(a, b);
  const f = Math.min(1 - 1e-6, Math.max(1e-6, node.frac));
  return gapMm + Math.max(a / f, b / (1 - f));
}

function findSplit(n: Node, id: string): Node | null {
  if (n.id === id) return n;
  return n.kind === 'split' ? (findSplit(n.a, id) ?? findSplit(n.b, id)) : null;
}

function splitIds(n: Node, out = new Set<string>()): Set<string> {
  if (n.kind === 'split') {
    out.add(n.id);
    splitIds(n.a, out);
    splitIds(n.b, out);
  }
  return out;
}

export interface EdgeDrag {
  splitId: string;
  dir: Dir;
  /** Position at the start of the drag. */
  start: number;
  /** Where the split's own area begins; position = origin + frac × available. */
  origin: number;
  available: number;
  /** Allowed positions (always include `start`, so nothing jumps). */
  min: number;
  max: number;
  /** Positions the edge snaps to: other edges in line with it, the middle of the sheet and of its own area. */
  targets: number[];
}

const pos = (d: DividerBox) => (d.dir === 'V' ? d.x : d.y);

export function beginEdgeDrag(tree: Node, sheet: Pick<Sheet, 'widthMm' | 'heightMm' | 'gapMm'>, splitId: string): EdgeDrag | null {
  const layout = computeLayout(tree, sheet);
  const d = layout.dividers.find((x) => x.splitId === splitId);
  const node = findSplit(tree, splitId);
  if (!d || !node || node.kind !== 'split' || d.available <= 0) return null;
  const start = pos(d);
  const origin = start - d.frac * d.available;
  const gap = Math.max(0, sheet.gapMm);
  const min = minCellMm(sheet);
  let lo = origin + minExtent(node.a, d.dir, gap, min);
  let hi = origin + d.available - minExtent(node.b, d.dir, gap, min);
  lo = Math.min(lo, start);
  hi = Math.max(hi, start);
  // Edges inside the dragged area move along with it – they are no targets.
  const inside = splitIds(node);
  const band = d.dir === 'V' ? d.w : d.h;
  const sheetLength = d.dir === 'V' ? sheet.widthMm : sheet.heightMm;
  const targets = [
    ...layout.dividers.filter((x) => x.dir === d.dir && !inside.has(x.splitId)).map(pos),
    sheetLength / 2 - band / 2,
    origin + d.available / 2,
  ].filter((t) => t >= lo && t <= hi);
  return { splitId, dir: d.dir, start, origin, available: d.available, min: lo, max: hi, targets };
}

/** Nearest target within `snapMm`, or `p` itself. */
export function snapTo(p: number, targets: readonly number[], snapMm: number): number {
  let best = p;
  let bestDist = snapMm;
  for (const t of targets) {
    const dist = Math.abs(t - p);
    if (dist <= bestDist) {
      best = t;
      bestDist = dist;
    }
  }
  return best;
}

/** The split fraction after moving the edge by `deltaMm`; `snapMm` = 0 turns snapping off. */
export function dragFrac(drag: EdgeDrag, deltaMm: number, snapMm: number): number {
  const p = Math.min(drag.max, Math.max(drag.min, snapTo(drag.start + deltaMm, drag.targets, snapMm)));
  return (p - drag.origin) / drag.available;
}

/**
 * Dividers under a point (mm). Each one can be grabbed `halfMm` beyond its band
 * on both sides, and at its ends also across a perpendicular band, so a line
 * that ends at a crossing can still be picked right there.
 */
export function dividersAt(layout: Layout, x: number, y: number, halfMm: number): DividerBox[] {
  return layout.dividers.filter((d) => {
    const vertical = d.dir === 'V';
    const band = vertical ? d.w : d.h;
    const across = Math.max(halfMm, band / 2);
    const along = (vertical ? d.h : d.w) / 2 + halfMm + band;
    const dx = Math.abs(x - (d.x + d.w / 2));
    const dy = Math.abs(y - (d.y + d.h / 2));
    return vertical ? dx <= across && dy <= along : dy <= across && dx <= along;
  });
}

/** Distance from a point to the divider's band (0 inside). */
export function distanceTo(d: DividerBox, x: number, y: number): number {
  const dx = Math.max(d.x - x, 0, x - (d.x + d.w));
  const dy = Math.max(d.y - y, 0, y - (d.y + d.h));
  return Math.hypot(dx, dy);
}
