import { describe, expect, it } from 'vitest';
import { beginEdgeDrag, cellEdge, dragFrac, junctions, minCellMm, minExtent, snapTo } from '../../src/core/edges';
import { computeLayout } from '../../src/core/geometry';
import { leaf, split } from './helpers';

const sheet = { widthMm: 300, heightMm: 260, gapMm: 6 };

describe('edges', () => {
  it('minimum cell size: 15 mm, less on small sheets', () => {
    expect(minCellMm({ widthMm: 504, heightMm: 506 })).toBe(15);
    expect(minCellMm({ widthMm: 100, heightMm: 150 })).toBeCloseTo(6);
  });

  it('minimum extent accounts for proportional scaling of nested splits', () => {
    expect(minExtent(leaf('a'), 'V', 6, 15)).toBe(15);
    // a gets 25% of what is left after the gap: 15 / 0.25 + 6.
    expect(minExtent(split('s', 'V', 0.25, leaf('a'), leaf('b')), 'V', 6, 15)).toBeCloseTo(66);
    // Across the split only the larger part counts.
    expect(minExtent(split('s', 'H', 0.25, leaf('a'), leaf('b')), 'V', 6, 15)).toBe(15);
  });

  it('a drag stops before a cell gets too small', () => {
    const tree = split('s', 'V', 0.5, leaf('a'), split('t', 'V', 0.5, leaf('b'), leaf('c')));
    const drag = beginEdgeDrag(tree, sheet, 's')!;
    expect(drag.start).toBeCloseTo(147);
    expect(drag.min).toBeCloseTo(15);
    // Right part: two halves of 15 mm + gap = 36 mm.
    expect(drag.max).toBeCloseTo(294 - 36);
    expect(dragFrac(drag, -1000, 0)).toBeCloseTo(15 / 294);
    expect(dragFrac(drag, 1000, 0)).toBeCloseTo(258 / 294);
  });

  it('a drag never jumps, even when the edge already is beyond the limit', () => {
    const tree = split('s', 'V', 0.02, leaf('a'), leaf('b'));
    const drag = beginEdgeDrag(tree, sheet, 's')!;
    expect(drag.min).toBeCloseTo(drag.start);
    expect(dragFrac(drag, 0, 0)).toBeCloseTo(0.02);
  });

  it('snaps to an edge in line with it, but not to edges that move along', () => {
    const tree = split('rows', 'H', 0.5, split('top', 'V', 0.4, leaf('a'), leaf('b')), split('bottom', 'V', 0.6, leaf('c'), leaf('d')));
    const top = computeLayout(tree, sheet).dividers.find((d) => d.splitId === 'top')!;
    const bottom = computeLayout(tree, sheet).dividers.find((d) => d.splitId === 'bottom')!;
    const drag = beginEdgeDrag(tree, sheet, 'top')!;
    expect(drag.targets).toContain(bottom.x);
    expect(dragFrac(drag, bottom.x - top.x - 2, 3)).toBeCloseTo(0.6);
    expect(dragFrac(drag, bottom.x - top.x - 2, 0)).not.toBeCloseTo(0.6);
    // The horizontal edge does not snap to anything inside its own rows.
    const rows = beginEdgeDrag(tree, sheet, 'rows')!;
    expect(rows.targets.length).toBeGreaterThan(0);
  });

  it('snaps to the middle of the sheet', () => {
    const tree = split('s', 'V', 0.3, leaf('a'), leaf('b'));
    const drag = beginEdgeDrag(tree, sheet, 's')!;
    expect(drag.targets).toContain(147);
    expect(snapTo(150, drag.targets, 4)).toBe(147);
    expect(snapTo(150, drag.targets, 2)).toBe(150);
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
