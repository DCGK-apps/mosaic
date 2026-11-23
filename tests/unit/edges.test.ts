import { describe, expect, it } from 'vitest';
import { beginEdgeDrag, dividersAt, dragFrac, minCellMm, minExtent, snapTo } from '../../src/core/edges';
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

  it('finds the edges under a point, including at a crossing', () => {
    const tree = split('rows', 'H', 0.5, split('top', 'V', 0.4, leaf('a'), leaf('b')), split('bottom', 'V', 0.4, leaf('c'), leaf('d')));
    const layout = computeLayout(tree, sheet);
    const h = layout.dividers.find((d) => d.splitId === 'rows')!;
    const v = layout.dividers.find((d) => d.splitId === 'top')!;
    const cross = dividersAt(layout, v.x + v.w / 2, h.y + h.h / 2, 4).map((d) => d.splitId);
    expect(cross).toEqual(expect.arrayContaining(['rows', 'top', 'bottom']));
    expect(dividersAt(layout, 20, h.y + h.h / 2, 4).map((d) => d.splitId)).toEqual(['rows']);
    expect(dividersAt(layout, 20, 20, 4)).toEqual([]);
  });
});
