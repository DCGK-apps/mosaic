import { describe, expect, it } from 'vitest';
import { cellRadius, computeLayout } from '../../src/core/geometry';
import { leaf, split } from './helpers';

const sheet = { widthMm: 210, heightMm: 100, gapMm: 10 };

describe('computeLayout', () => {
  it('splits the space without the gap by the divider position', () => {
    const { cells, dividers } = computeLayout(split('s', 'V', 0.25, leaf('a'), leaf('b')), sheet);
    expect(cells.map(({ x, y, w, h }) => [x, y, w, h])).toEqual([
      [0, 0, 50, 100],
      [60, 0, 150, 100],
    ]);
    expect(dividers).toEqual([{ splitId: 's', dir: 'V', x: 50, y: 0, w: 10, h: 100, available: 200, frac: 0.25 }]);
  });

  it('tiles the sheet: cells plus gaps cover it exactly, without overlaps', () => {
    const tree = split('s1', 'H', 0.4, split('s2', 'V', 0.5, leaf('a'), leaf('b')), split('s3', 'V', 0.7, leaf('c'), leaf('d')));
    const { cells, dividers } = computeLayout(tree, { widthMm: 300, heightMm: 200, gapMm: 6 });
    const cellArea = cells.reduce((s, c) => s + c.w * c.h, 0);
    // One horizontal band across the sheet, one vertical band in each row.
    const gapArea = 300 * 6 + dividers.filter((d) => d.dir === 'V').reduce((s, d) => s + d.w * d.h, 0);
    expect(cellArea + gapArea).toBeCloseTo(300 * 200);
    for (const a of cells)
      for (const b of cells) {
        if (a === b) continue;
        const overlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        expect(overlap).toBe(0);
      }
  });

  it('handles an empty tree, one photo and a gap larger than the space', () => {
    expect(computeLayout(null, sheet)).toEqual({ cells: [], dividers: [] });
    expect(computeLayout(leaf('a'), sheet).cells[0]).toMatchObject({ x: 0, y: 0, w: 210, h: 100 });
    const tiny = computeLayout(split('s', 'H', 0.5, leaf('a'), leaf('b')), { widthMm: 10, heightMm: 4, gapMm: 50 });
    expect(tiny.cells.every((c) => c.h >= 0)).toBe(true);
  });

  it('caps the corner radius at half the shorter side', () => {
    expect(cellRadius(5, { x: 0, y: 0, w: 100, h: 50 })).toBe(5);
    expect(cellRadius(40, { x: 0, y: 0, w: 100, h: 50 })).toBe(25);
    expect(cellRadius(-1, { x: 0, y: 0, w: 100, h: 50 })).toBe(0);
  });
});
