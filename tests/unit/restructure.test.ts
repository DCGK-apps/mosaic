import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/core/geometry';
import { isolateSegment } from '../../src/core/restructure';
import { setFrac } from '../../src/core/tree';
import type { Node } from '../../src/core/types';
import { leaf, split } from './helpers';

const sheet = { widthMm: 300, heightMm: 200, gapMm: 6 };

const rects = (tree: Node) =>
  Object.fromEntries(computeLayout(tree, sheet).cells.map((c) => [c.leafId, [c.x, c.y, c.w, c.h]]));

function expectSamePicture(a: Node, b: Node) {
  const ra = rects(a);
  const rb = rects(b);
  expect(Object.keys(rb).toSorted()).toEqual(Object.keys(ra).toSorted());
  for (const id of Object.keys(ra)) ra[id]!.forEach((v, i) => expect(rb[id]![i]).toBeCloseTo(v, 9));
}

function ids(n: Node): string[] {
  return n.kind === 'leaf' ? [n.id] : [n.id, ...ids(n.a), ...ids(n.b)];
}

const expectClose = (a: number[] | undefined, b: number[] | undefined) => b!.forEach((v, i) => expect(a![i]).toBeCloseTo(v, 9));

const divider = (tree: Node, id: string) => computeLayout(tree, sheet).dividers.find((d) => d.splitId === id)!;

/** Two rows, each split at the same place: the edges form a cross. */
const cross = split('rows', 'H', 0.5, split('top', 'V', 0.4, leaf('a'), leaf('b')), split('bottom', 'V', 0.4, leaf('c'), leaf('d')));

describe('isolateSegment', () => {
  it('cuts a crossed edge: the grabbed half becomes an edge of its own, the picture stays', () => {
    const h = divider(cross, 'rows');
    const next = isolateSegment(cross, sheet, 'rows', { x: 20, y: h.y + 3 });
    expectSamePicture(cross, next);
    const left = divider(next, 'rows');
    const v = divider(cross, 'top');
    expect(left.x).toBeCloseTo(0);
    expect(left.w).toBeCloseTo(v.x); // ends where the vertical edge begins
    expect(new Set(ids(next)).size).toBe(ids(next).length);
  });

  it('the right half keeps the id when grabbed there', () => {
    const h = divider(cross, 'rows');
    const next = isolateSegment(cross, sheet, 'rows', { x: 280, y: h.y + 3 });
    const right = divider(next, 'rows');
    expect(right.x + right.w).toBeCloseTo(300);
  });

  it('moving the cut part changes only the cells next to it', () => {
    const h = divider(cross, 'rows');
    const next = isolateSegment(cross, sheet, 'rows', { x: 20, y: h.y + 3 });
    const moved = rects(setFrac(next, 'rows', 0.3));
    const before = rects(cross);
    expect(moved.a![3]).toBeLessThan(before.a![3]!); // a gets lower
    expect(moved.c![3]).toBeGreaterThan(before.c![3]!); // c gets taller
    expectClose(moved.b, before.b);
    expectClose(moved.d, before.d);
  });

  it('leaves the tree alone when the point is on the crossing', () => {
    const h = divider(cross, 'rows');
    const v = divider(cross, 'top');
    expect(isolateSegment(cross, sheet, 'rows', { x: v.x + v.w / 2, y: h.y + 3 })).toBe(cross);
    expect(isolateSegment(cross, sheet, 'rows', { x: v.x - 1, y: h.y + 3 }, 2)).toBe(cross);
  });

  it('does not cut at a T-junction (the lines are not in line)', () => {
    const t = split('rows', 'H', 0.5, split('top', 'V', 0.4, leaf('a'), leaf('b')), split('bottom', 'V', 0.6, leaf('c'), leaf('d')));
    const h = divider(t, 'rows');
    expect(isolateSegment(t, sheet, 'rows', { x: 20, y: h.y + 3 })).toBe(t);
  });

  it('cuts at every crossing: the middle part of a 3×2 grid', () => {
    // Columns aligned in both rows: 100 mm each (gap 6 → available 288, thirds).
    const row = (p: string) => split(`${p}1`, 'V', 1 / 3, leaf(`${p}a`), split(`${p}2`, 'V', 0.5, leaf(`${p}b`), leaf(`${p}c`)));
    const grid = split('rows', 'H', 0.5, row('t'), row('b'));
    const h = divider(grid, 'rows');
    const next = isolateSegment(grid, sheet, 'rows', { x: 150, y: h.y + 3 });
    expectSamePicture(grid, next);
    const mid = divider(next, 'rows');
    const cells = rects(grid);
    expect(mid.x).toBeCloseTo(cells.tb![0]!);
    expect(mid.w).toBeCloseTo(cells.tb![2]!);
    const moved = rects(setFrac(next, 'rows', 0.7));
    expectClose(moved.ta, cells.ta);
    expectClose(moved.tc, cells.tc);
    expect(moved.tb![3]).toBeGreaterThan(cells.tb![3]!);
  });

  it('works on vertical edges and without a gap', () => {
    const noGap = { ...sheet, gapMm: 0 };
    const cols = split('cols', 'V', 0.5, split('l', 'H', 0.3, leaf('a'), leaf('b')), split('r', 'H', 0.3, leaf('c'), leaf('d')));
    const next = isolateSegment(cols, noGap, 'cols', { x: 150, y: 190 });
    const r = (t: Node) => Object.fromEntries(computeLayout(t, noGap).cells.map((c) => [c.leafId, [c.x, c.y, c.w, c.h]]));
    const before = r(cols);
    const after = r(next);
    for (const id of Object.keys(before)) before[id]!.forEach((v, i) => expect(after[id]![i]).toBeCloseTo(v, 9));
    const d = computeLayout(next, noGap).dividers.find((x) => x.splitId === 'cols')!;
    expect(d.y).toBeCloseTo(60);
    expect(d.h).toBeCloseTo(140);
  });

  it('cuts at a nested edge in line with one on the other side', () => {
    // Left: three rows; right: two rows whose edge is in line with the lower edge on the left.
    // Left: a = 0.25 × 194 = 48.5, then b = 0.5 × 139.5 → that edge starts at 124.25 mm.
    const tree = split(
      'cols',
      'V',
      0.5,
      split('l1', 'H', 0.25, leaf('a'), split('l2', 'H', 0.5, leaf('b'), leaf('c'))),
      split('r1', 'H', 124.25 / 194, leaf('d'), leaf('e')),
    );
    expect(divider(tree, 'l2').y).toBeCloseTo(divider(tree, 'r1').y, 9);
    const v = divider(tree, 'cols');
    const next = isolateSegment(tree, sheet, 'cols', { x: v.x + 3, y: 190 });
    expectSamePicture(tree, next);
    const lower = divider(next, 'cols');
    expect(lower.y).toBeCloseTo(130.25);
    expect(lower.y + lower.h).toBeCloseTo(200);
    const moved = rects(setFrac(next, 'cols', 0.3));
    const before = rects(tree);
    for (const id of ['a', 'b', 'd']) expectClose(moved[id], before[id]);
    expect(moved.c![2]).toBeLessThan(before.c![2]!);
  });
});
