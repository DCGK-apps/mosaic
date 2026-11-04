import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/core/geometry';
import { autoLayout, centralLayout, colsLayout, fixedLayout, gridLayout, rowsLayout } from '../../src/core/layouts';
import { createRng } from '../../src/core/random';
import { leaves } from '../../src/core/tree';
import type { Node, Photo } from '../../src/core/types';
import { counter, photo } from './helpers';

const photos = (n: number) => Array.from({ length: n }, (_, i) => photo(`p${i}`, 300 + i * 40, 300));
const used = (t: Node | null) => leaves(t).map((l) => l.photoId).toSorted();
const ids = (ps: Photo[]) => ps.map((p) => p.id).toSorted();
const sheet = { widthMm: 400, heightMm: 300, gapMm: 0 };
const cellsOf = (t: Node | null, s = sheet) => computeLayout(t, s).cells;

describe('fixed layouts', () => {
  it.each([1, 2, 3, 5, 8, 13])('every layout uses each of %i photos exactly once', (n) => {
    const ps = photos(n);
    for (const mode of ['grid', 'central', 'rows', 'cols'] as const) {
      expect(used(fixedLayout(mode, ps, createRng(1)))).toEqual(ids(ps));
    }
  });

  it('rows and columns are equal stripes', () => {
    const rows = cellsOf(rowsLayout(photos(4), counter()));
    expect(rows.map((c) => c.h)).toEqual([75, 75, 75, 75]);
    expect(rows.every((c) => c.w === 400)).toBe(true);
    const cols = cellsOf(colsLayout(photos(4), counter()));
    expect(cols.map((c) => c.w)).toEqual([100, 100, 100, 100]);
  });

  it('grid: ⌈√n⌉ columns, the last row stretched instead of repeating photos', () => {
    const cells = cellsOf(gridLayout(photos(7), counter()));
    expect(cells).toHaveLength(7);
    const rowsY = [...new Set(cells.map((c) => Math.round(c.y)))];
    expect(rowsY).toHaveLength(3);
    expect(cells.filter((c) => Math.round(c.y) === rowsY[2]).map((c) => c.w)).toEqual([400]);
    expect(cells.filter((c) => Math.round(c.y) === rowsY[0]).map((c) => Math.round(c.w))).toEqual([133, 133, 133]);
    expect(new Set(cells.map((c) => c.photoId)).size).toBe(7);
  });

  it('central: the first photo sits exactly in the middle', () => {
    for (const n of [3, 5, 9]) {
      const cells = cellsOf(centralLayout(photos(n), counter()));
      const center = cells.find((c) => c.photoId === 'p0')!;
      expect(center.x + center.w / 2).toBeCloseTo(200);
      expect(center.w).toBeCloseTo(200);
      if (n >= 5) {
        expect(center.y + center.h / 2).toBeCloseTo(150);
        expect(center.h).toBeCloseTo(150);
      }
    }
  });

  it('central with two photos: the second on the left, ⅓ wide', () => {
    const cells = cellsOf(centralLayout(photos(2), counter()));
    expect(cells.map((c) => [c.photoId, Math.round(c.w)])).toEqual([
      ['p1', 133],
      ['p0', 267],
    ]);
  });

  it('empty input gives no layout', () => {
    expect(gridLayout([], counter())).toBeNull();
    expect(centralLayout([], counter())).toBeNull();
    expect(autoLayout([], sheet, createRng(1))).toBeNull();
  });
});

describe('autoLayout', () => {
  it('is reproducible for a seed and uses every photo once', () => {
    const ps = photos(6);
    const a = autoLayout(ps, sheet, createRng(42), 200);
    expect(autoLayout(ps, sheet, createRng(42), 200)).toEqual(a);
    expect(used(a)).toEqual(ids(ps));
    expect(autoLayout(ps, sheet, createRng(43), 200)).not.toEqual(a);
  });

  it('the widest photo gets the widest cell, the tallest the tallest', () => {
    const ps = [photo('square', 500, 500), photo('wide', 900, 300), photo('tall', 300, 900)];
    for (const seed of [1, 2, 3]) {
      const cells = cellsOf(autoLayout(ps, sheet, createRng(seed), 300)).toSorted((a, b) => b.w / b.h - a.w / a.h);
      expect(cells.map((c) => c.photoId)).toEqual(['wide', 'square', 'tall']);
    }
  });

  it('prefers cells close to the photo proportions', () => {
    const ps = [photo('a', 400, 300), photo('b', 400, 300)];
    const tall = { widthMm: 400, heightMm: 600, gapMm: 0 };
    const cells = cellsOf(autoLayout(ps, tall, createRng(5), 500), tall);
    // Two 4:3 photos on a tall sheet: stacked, not side by side.
    for (const c of cells) expect(c.w / c.h).toBeGreaterThan(1);
  });

  it('a single photo fills the sheet', () => {
    const t = autoLayout([photo('a')], sheet, createRng(1));
    expect(t).toMatchObject({ kind: 'leaf', photoId: 'a' });
  });
});
