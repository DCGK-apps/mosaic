import { computeLayout, type DividerBox } from './geometry';
import type { Dir, Node, Rect, Sheet, Split } from './types';

/**
 * Geometry-preserving rewrites of the layout tree.
 *
 * The same picture can be built in several ways: a 2×2 grid is either "two rows,
 * each split in two" or "two columns, each split in two". The tree decides which
 * line is one divider and which consists of independent segments. When two edges
 * meet and form a cross, the user may want to move only one part of the line
 * crossed by the other – so the tree is rewritten on the fly into an equivalent
 * one where that part is a divider of its own. Every cell keeps its rectangle.
 */

type Rects = ReadonlyMap<string, Rect>;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Positions closer than this (mm) count as the same line. */
const ALIGN_EPS_MM = 0.01;

function bbox(n: Node, rects: Rects): Box {
  if (n.kind === 'leaf') {
    const r = rects.get(n.id)!;
    return { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h };
  }
  const a = bbox(n.a, rects);
  const b = bbox(n.b, rects);
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

const lo = (b: Box, dir: Dir) => (dir === 'V' ? b.x0 : b.y0);
const hi = (b: Box, dir: Dir) => (dir === 'V' ? b.x1 : b.y1);

/** Where the split's gap band starts (the far edge of its first part), in mm. */
const linePos = (s: Split, rects: Rects) => hi(bbox(s.a, rects), s.dir);

function contains(n: Node, id: string): boolean {
  return n.id === id || (n.kind === 'split' && (contains(n.a, id) || contains(n.b, id)));
}

function find(n: Node, id: string): Node | null {
  if (n.id === id) return n;
  return n.kind === 'split' ? (find(n.a, id) ?? find(n.b, id)) : null;
}

function splitsIn(n: Node): Split[] {
  return n.kind === 'leaf' ? [] : [n, ...splitsIn(n.a), ...splitsIn(n.b)];
}

function allIds(n: Node, out = new Set<string>()): Set<string> {
  out.add(n.id);
  if (n.kind === 'split') {
    allIds(n.a, out);
    allIds(n.b, out);
  }
  return out;
}

function mapNodes(n: Node, fn: (n: Node) => Node): Node {
  if (n.kind === 'leaf') return fn(n);
  const a = mapNodes(n.a, fn);
  const b = mapNodes(n.b, fn);
  return fn(a === n.a && b === n.b ? n : { ...n, a, b });
}

const replace = (tree: Node, id: string, by: Node) => mapNodes(tree, (n) => (n.id === id ? by : n));

/**
 * Rewrite `node` so that the split `targetId` becomes its root, keeping every
 * cell where it is. Returns null when impossible (the line does not run across
 * the whole of `node`). Fractions are left stale – `refit` fixes them.
 */
function raise(node: Node, targetId: string, rects: Rects, newId: () => string): Node | null {
  if (node.kind === 'leaf') return null;
  if (node.id === targetId) return node;
  const inA = contains(node.a, targetId);
  if (!inA && !contains(node.b, targetId)) return null;
  const target = find(node, targetId) as Split;
  const raised = raise(inA ? node.a : node.b, targetId, rects, newId);
  if (!raised || raised.kind !== 'split') return null;

  if (node.dir === target.dir) {
    // ((X | Y) | Z) → (X | (Y | Z)) and (X | (Y | Z)) → ((X | Y) | Z): same order, same cells.
    return inA ? { ...raised, b: { ...node, a: raised.b } } : { ...raised, a: { ...node, b: raised.a } };
  }

  // Perpendicular: the line must continue through the other part too, at the same position.
  const other = inA ? node.b : node.a;
  const pos = linePos(raised, rects);
  let raisedOther: Node | null = null;
  for (const c of splitsIn(other)) {
    if (c.dir !== target.dir || Math.abs(linePos(c, rects) - pos) > ALIGN_EPS_MM) continue;
    raisedOther = raise(other, c.id, rects, newId);
    if (raisedOther) break;
  }
  if (!raisedOther || raisedOther.kind !== 'split') return null;
  const A = inA ? raised : raisedOther;
  const B = inA ? raisedOther : raised;
  // (A1 | A2) over (B1 | B2)  →  (A1 over B1) | (A2 over B2)
  return {
    kind: 'split',
    id: targetId,
    dir: target.dir,
    frac: target.frac,
    a: { ...node, a: A.a, b: B.a },
    b: { ...node, id: newId(), a: A.b, b: B.b },
  };
}

/** Recomputes every fraction so that each cell gets exactly the rectangle from `rects`. */
function refit(n: Node, rects: Rects, gapMm: number): Node {
  if (n.kind === 'leaf') return n;
  const a = refit(n.a, rects, gapMm);
  const b = refit(n.b, rects, gapMm);
  const box = bbox(n, rects);
  const length = hi(box, n.dir) - lo(box, n.dir);
  const available = length - Math.min(gapMm, length);
  const frac = available > 0 ? (hi(bbox(n.a, rects), n.dir) - lo(box, n.dir)) / available : n.frac;
  const same = Math.abs(frac - n.frac) < 1e-12;
  return a === n.a && b === n.b && same ? n : { ...n, a, b, frac: same ? n.frac : frac };
}

/** The other dividers that meet `d` (end on its band), perpendicular to it. */
function touching(d: DividerBox, dividers: readonly DividerBox[]): DividerBox[] {
  const eps = ALIGN_EPS_MM;
  return dividers.filter((c) => {
    if (c.dir === d.dir) return false;
    if (d.dir === 'H') {
      const meets = Math.abs(c.y + c.h - d.y) < eps || Math.abs(c.y - (d.y + d.h)) < eps;
      return meets && c.x >= d.x - eps && c.x + c.w <= d.x + d.w + eps;
    }
    const meets = Math.abs(c.x + c.w - d.x) < eps || Math.abs(c.x - (d.x + d.w)) < eps;
    return meets && c.y >= d.y - eps && c.y + c.h <= d.y + d.h + eps;
  });
}

/** Perpendicular dividers whose band touches `d`'s band: crossing it, ending on it, or where `d` ends. */
function adjoining(d: DividerBox, dividers: readonly DividerBox[]): DividerBox[] {
  const eps = ALIGN_EPS_MM;
  const touch = (a0: number, a1: number, b0: number, b1: number) => a1 >= b0 - eps && a0 <= b1 + eps;
  return dividers.filter((c) => c.dir !== d.dir && touch(c.x, c.x + c.w, d.x, d.x + d.w) && touch(c.y, c.y + c.h, d.y, d.y + d.h));
}

function pathTo(n: Node, id: string): Split[] | null {
  if (n.id === id) return [];
  if (n.kind === 'leaf') return null;
  const below = pathTo(n.a, id) ?? pathTo(n.b, id);
  return below ? [n, ...below] : null;
}

/**
 * Join split `splitId` with the parts in line with it into one divider, as long
 * as the line runs straight across crossings (the inverse of cutting it). The
 * picture does not change. Returns the same tree when there is nothing to join.
 */
export function joinLine(tree: Node, sheet: Pick<Sheet, 'widthMm' | 'heightMm' | 'gapMm'>, splitId: string, newId?: () => string): Node {
  const s = find(tree, splitId);
  const path = pathTo(tree, splitId);
  if (!s || s.kind !== 'split' || !path) return tree;
  const ids = allIds(tree);
  let counter = 0;
  const fresh =
    newId ??
    ((): string => {
      let id: string;
      do id = `${splitId}~${++counter}`;
      while (ids.has(id));
      ids.add(id);
      return id;
    });
  const layout = computeLayout(tree, sheet);
  const rects = new Map(layout.cells.map((c) => [c.leafId, c as Rect]));
  // The highest perpendicular ancestor the line runs across gives the longest line.
  for (const ancestor of path) {
    if (ancestor.dir === s.dir) continue;
    const raised = raise(ancestor, splitId, rects, fresh);
    if (raised) return refit(replace(tree, ancestor.id, raised), rects, Math.max(0, sheet.gapMm));
  }
  return tree;
}

/**
 * Make the part of divider `splitId` under the point `at` (mm of the sheet) a
 * divider of its own: the line is cut at every place where another line crosses
 * it. The picture does not change. The part under the point keeps `splitId`, so
 * the drag can go on with the same id. When the point lies on a crossing
 * (within `tolMm`), the whole line moves instead: the parts in line with it are
 * joined into one divider (`joinLine`).
 */
export function isolateSegment(tree: Node, sheet: Pick<Sheet, 'widthMm' | 'heightMm' | 'gapMm'>, splitId: string, at: { x: number; y: number }, tolMm = 0): Node {
  const ids = allIds(tree);
  let counter = 0;
  const newId = (): string => {
    let id: string;
    do id = `${splitId}~${++counter}`;
    while (ids.has(id));
    ids.add(id);
    return id;
  };
  const gap = Math.max(0, sheet.gapMm);
  const start = computeLayout(tree, sheet).dividers;
  const first = start.find((x) => x.splitId === splitId);
  if (!first) return tree;
  const alongFirst = first.dir === 'H' ? at.x : at.y;
  const atCrossing = adjoining(first, start).some((c) =>
    first.dir === 'H' ? alongFirst >= c.x - tolMm && alongFirst <= c.x + c.w + tolMm : alongFirst >= c.y - tolMm && alongFirst <= c.y + c.h + tolMm,
  );
  if (atCrossing) return joinLine(tree, sheet, splitId, newId);
  let current = tree;
  let id = splitId;
  for (let guard = 0; guard < 64; guard++) {
    const layout = computeLayout(current, sheet);
    const d = layout.dividers.find((x) => x.splitId === id);
    const s = find(current, id);
    if (!d || !s || s.kind !== 'split') break;
    const meeting = touching(d, layout.dividers);
    const along = d.dir === 'H' ? at.x : at.y;
    const onCrossing = meeting.some((c) => (d.dir === 'H' ? along >= c.x - tolMm && along <= c.x + c.w + tolMm : along >= c.y - tolMm && along <= c.y + c.h + tolMm));
    if (onCrossing) break;
    const rects = new Map(layout.cells.map((c) => [c.leafId, c as Rect]));
    let next: { tree: Node; id: string } | null = null;
    for (const c of meeting) {
      const raised = raise(s, c.splitId, rects, newId);
      if (!raised || raised.kind !== 'split') continue;
      // The line is now two splits, one on each side of the crossing line.
      const cut = linePos(raised, rects);
      const mine = ((d.dir === 'H' ? at.x : at.y) < cut ? raised.a : raised.b) as Split;
      next = { tree: refit(replace(current, s.id, raised), rects, gap), id: mine.id };
      break;
    }
    if (!next) break;
    current = next.tree;
    id = next.id;
  }
  if (id === splitId) return current;
  // Give the part under the pointer the original id (the other part takes the new one).
  return mapNodes(current, (n) => (n.id === id ? { ...n, id: splitId } : n.id === splitId ? { ...n, id } : n));
}
