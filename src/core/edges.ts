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

export interface Junction {
  /** Where the bands of the crossing lines overlap, in mm. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Dividers that make up the vertical and the horizontal line here. */
  vertical: string[];
  horizontal: string[];
}

/**
 * Crossings: places where a vertical and a horizontal line both go on to the
 * other side ("+"). Grabbed there, the whole line moves (joinLine). T-junctions
 * are not crossings – a line ending on another one is just one edge.
 */
export function junctions(layout: Layout): Junction[] {
  const eps = 0.01;
  const vs = layout.dividers.filter((d) => d.dir === 'V');
  const hs = layout.dividers.filter((d) => d.dir === 'H');
  const out: Junction[] = [];
  const seen = new Set<string>();
  for (const v of vs) {
    for (const h of hs) {
      // The bands must touch or overlap.
      if (v.x > h.x + h.w + eps || v.x + v.w < h.x - eps || h.y > v.y + v.h + eps || h.y + h.h < v.y - eps) continue;
      const x0 = v.x;
      const x1 = v.x + v.w;
      const y0 = h.y;
      const y1 = h.y + h.h;
      const key = `${x0.toFixed(3)}:${y0.toFixed(3)}`;
      if (seen.has(key)) continue;
      const vLine = vs.filter((d) => Math.abs(d.x - x0) < eps && d.y <= y1 + eps && d.y + d.h >= y0 - eps);
      const hLine = hs.filter((d) => Math.abs(d.y - y0) < eps && d.x <= x1 + eps && d.x + d.w >= x0 - eps);
      const up = vLine.some((d) => d.y < y0 - eps);
      const down = vLine.some((d) => d.y + d.h > y1 + eps);
      const left = hLine.some((d) => d.x < x0 - eps);
      const right = hLine.some((d) => d.x + d.w > x1 + eps);
      if (!(up && down && left && right)) continue;
      seen.add(key);
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, vertical: vLine.map((d) => d.splitId), horizontal: hLine.map((d) => d.splitId) });
    }
  }
  return out;
}

/**
 * The edge of `cell` that a drag inside it moves: along `dir` ('V' – a vertical
 * edge, moved sideways), the side nearer to the point `at` (mm); the other side
 * when the near one is the border of the sheet. Null when the cell has no
 * such edge (e.g. it spans the whole width).
 */
export function cellEdge(layout: Layout, cell: { x: number; y: number; w: number; h: number }, dir: Dir, at: { x: number; y: number }): DividerBox | null {
  const eps = 0.01;
  const along = (d: DividerBox) => (dir === 'V' ? d.y < cell.y + cell.h - eps && d.y + d.h > cell.y + eps : d.x < cell.x + cell.w - eps && d.x + d.w > cell.x + eps);
  const before = layout.dividers.find((d) => d.dir === dir && along(d) && Math.abs((dir === 'V' ? d.x + d.w - cell.x : d.y + d.h - cell.y)) < eps) ?? null;
  const after = layout.dividers.find((d) => d.dir === dir && along(d) && Math.abs((dir === 'V' ? d.x - (cell.x + cell.w) : d.y - (cell.y + cell.h))) < eps) ?? null;
  if (!before || !after) return before ?? after;
  const p = dir === 'V' ? at.x - cell.x : at.y - cell.y;
  return p < (dir === 'V' ? cell.w : cell.h) / 2 ? before : after;
}
