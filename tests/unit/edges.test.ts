import { describe, expect, it } from 'vitest';
import { beginEdgeDrag, cellEdge, dragFrac, junctions, minCellMm, moveEdge, snapTo } from '../../src/core/edges';
import { computeLayout } from '../../src/core/geometry';
import { leaf, split } from './helpers';

const sheet = { widthMm: 300, heightMm: 260, gapMm: 6 };

describe('edges', () => {
  it('minimum cell size: 15 mm, less on small sheets', () => {
    expect(minCellMm({ widthMm: 504, heightMm: 506 })).toBe(15);
    expect(minCellMm({ widthMm: 100, heightMm: 150 })).toBeCloseTo(6);
  });

  it('a drag stops before a photo next to the edge gets too small', () => {
    const tree = split('s', 'V', 0.5, leaf('a'), split('t', 'V', 0.5, leaf('b'), leaf('c')));
    const layout = computeLayout(tree, sheet);
    const t = layout.dividers.find((d) => d.splitId === 't')!;
    const drag = beginEdgeDrag(tree, sheet, 's')!;
    expect(drag.start).toBeCloseTo(147);
    expect(drag.min).toBeCloseTo(15);
    // b lies between this edge (+ gap) and the edge t, which stays where it is.
    expect(drag.max).toBeCloseTo(t.x - 15 - 6);
    expect(dragFrac(drag, -1000, 0)).toBeCloseTo(15 / 294);
  });

  it('moveEdge keeps every other edge in place – only the photos next to it change', () => {
    // Grid 3×3 as columns, each cut into rows; then move the first column edge.
    const col = (p: string) => split(`${p}1`, 'H', 1 / 3, leaf(`${p}a`), split(`${p}2`, 'H', 0.5, leaf(`${p}b`), leaf(`${p}c`)));
    const tree = split('c1', 'V', 1 / 3, col('l'), split('c2', 'V', 0.5, col('m'), col('r')));
    const before = computeLayout(tree, sheet);
    const moved = moveEdge(tree, sheet, 'c1', 0.2);
    const after = computeLayout(moved, sheet);
    const at = (l: typeof before, id: string) => l.dividers.find((d) => d.splitId === id)!;
    expect(at(after, 'c1').x).toBeCloseTo(0.2 * 294);
    expect(at(after, 'c2').x).toBeCloseTo(at(before, 'c2').x, 9);
    for (const id of ['l1', 'l2', 'm1', 'm2', 'r1', 'r2']) expect(at(after, id).y).toBeCloseTo(at(before, id).y, 9);
    const cell = (l: typeof before, id: string) => l.cells.find((c) => c.leafId === id)!;
    expect(cell(after, 'rb')).toEqual(cell(before, 'rb'));
    expect(cell(after, 'mb').w).toBeGreaterThan(cell(before, 'mb').w);
    // Moving a split whose inside has no parallel edges is plain setFrac.
    const simple = split('s', 'V', 0.5, leaf('a'), leaf('b'));
    expect((moveEdge(simple, sheet, 's', 0.3) as typeof simple).frac).toBe(0.3);
  });

  it('moveEdge keeps other edges in place with a frame around the collage too', () => {
    const framed = { ...sheet, outerFrame: true };
    const tree = split('c1', 'V', 0.5, leaf('a'), split('c2', 'V', 0.5, leaf('b'), leaf('c')));
    const before = computeLayout(tree, framed);
    const after = computeLayout(moveEdge(tree, framed, 'c1', 0.3), framed);
    const at = (l: typeof before, id: string) => l.dividers.find((d) => d.splitId === id)!;
    expect(at(after, 'c1').x).toBeCloseTo(6 + 0.3 * (300 - 12 - 6));
    expect(at(after, 'c2').x).toBeCloseTo(at(before, 'c2').x, 9);
    const c = after.cells.find((x) => x.leafId === 'c')!;
    expect(c.x + c.w).toBeCloseTo(300 - 6);
  });

  it('a drag never jumps, even when the edge already is beyond the limit', () => {
    const tree = split('s', 'V', 0.02, leaf('a'), leaf('b'));
    const drag = beginEdgeDrag(tree, sheet, 's')!;
    expect(drag.min).toBeCloseTo(drag.start);
    expect(dragFrac(drag, 0, 0)).toBeCloseTo(0.02);
  });

  it('snaps to a parallel edge', () => {
    const tree = split('rows', 'H', 0.5, split('top', 'V', 0.4, leaf('a'), leaf('b')), split('bottom', 'V', 0.6, leaf('c'), leaf('d')));
    const top = computeLayout(tree, sheet).dividers.find((d) => d.splitId === 'top')!;
    const bottom = computeLayout(tree, sheet).dividers.find((d) => d.splitId === 'bottom')!;
    const drag = beginEdgeDrag(tree, sheet, 'top')!;
    expect(drag.targets).toContain(bottom.x);
    expect(dragFrac(drag, bottom.x - top.x - 2, 3)).toBeCloseTo(0.6);
    expect(dragFrac(drag, bottom.x - top.x - 2, 0)).not.toBeCloseTo(0.6);
    // The horizontal edge has nothing to snap to.
    const rows = beginEdgeDrag(tree, sheet, 'rows')!;
    expect(rows.targets).toEqual([]); // no other horizontal edge
  });

  it('snapTo: the nearest target within reach', () => {
    expect(snapTo(150, [147, 160], 4)).toBe(147);
    expect(snapTo(150, [147, 160], 2)).toBe(150);
  });

  it('finds crossings (+), not T-junctions', () => {
    const cross = split('rows', 'H', 0.5, split('top', 'V', 0.4, leaf('a'), leaf('b')), split('bottom', 'V', 0.4, leaf('c'), leaf('d')));
    const js = junctions(computeLayout(cross, sheet));
    expect(js).toHaveLength(1);
    expect(js[0]!.vertical.toSorted()).toEqual(['bottom', 'top']);
    expect(js[0]!.horizontal).toEqual(['rows']);
    const v = computeLayout(cross, sheet).dividers.find((d) => d.splitId === 'top')!;
    expect(js[0]!.x).toBeCloseTo(v.x);
    // Not in line: two T-junctions, no crossing.
    const ts = split('rows', 'H', 0.5, split('top', 'V', 0.4, leaf('a'), leaf('b')), split('bottom', 'V', 0.6, leaf('c'), leaf('d')));
    expect(junctions(computeLayout(ts, sheet))).toEqual([]);
    // Also without a gap.
    expect(junctions(computeLayout(cross, { ...sheet, gapMm: 0 }))).toHaveLength(1);
    // Columns cut into rows at the same height: a crossing made of four parts.
    const cols = split('cols', 'V', 0.5, split('l', 'H', 0.3, leaf('a'), leaf('b')), split('r', 'H', 0.3, leaf('c'), leaf('d')));
    const jc = junctions(computeLayout(cols, sheet));
    expect(jc).toHaveLength(1);
    expect(jc[0]!.horizontal.toSorted()).toEqual(['l', 'r']);
  });

  it('cellEdge: the edge of a photo nearer to the finger, along the drag', () => {
    // a | b over c | d, columns at different places.
    const tree = split('rows', 'H', 0.5, split('top', 'V', 0.4, leaf('a'), leaf('b')), split('bottom', 'V', 0.6, leaf('c'), leaf('d')));
    const layout = computeLayout(tree, sheet);
    const cell = (id: string) => layout.cells.find((c) => c.leafId === id)!;
    const b = cell('b');
    // Sideways in b: its only vertical edge is on the left (the right one is the sheet border).
    expect(cellEdge(layout, b, 'V', { x: b.x + b.w - 1, y: b.y + 5 })!.splitId).toBe('top');
    // Up/down in b: the edge below it.
    expect(cellEdge(layout, b, 'H', { x: b.x + 5, y: b.y + 1 })!.splitId).toBe('rows');
    // Up/down in a cell spanning the whole height: nothing to move.
    const cols = split('s', 'V', 0.5, leaf('l'), leaf('r'));
    const l2 = computeLayout(cols, sheet);
    expect(cellEdge(l2, l2.cells[0]!, 'H', { x: 5, y: 5 })).toBeNull();
    // Middle of three columns: the nearer side wins.
    const three = split('s1', 'V', 1 / 3, leaf('x'), split('s2', 'V', 0.5, leaf('y'), leaf('z')));
    const l3 = computeLayout(three, sheet);
    const y = l3.cells.find((c) => c.leafId === 'y')!;
    expect(cellEdge(l3, y, 'V', { x: y.x + 2, y: 10 })!.splitId).toBe('s1');
    expect(cellEdge(l3, y, 'V', { x: y.x + y.w - 2, y: 10 })!.splitId).toBe('s2');
  });
});
