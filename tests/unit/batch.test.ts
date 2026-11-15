import { describe, expect, it } from 'vitest';
import { batchCopy, buildBatch, clampRange, collageCount, inChosenFolder, planBatch, seriesFileBase, sortFiles, writeBack, type BatchOptions } from '../../src/core/batch';
import { currentTree, DEFAULT_SHEET, docReducer } from '../../src/core/doc';
import { leaves } from '../../src/core/tree';
import { photo } from './helpers';

const photos = (n: number, w = 400, h = 300) => Array.from({ length: n }, (_, i) => photo(`p${i}`, w, h));
const opts = (min: number, max: number, mode: BatchOptions['mode'] = 'auto'): BatchOptions => ({ min, max, mode, sheet: { ...DEFAULT_SHEET } });
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

describe('sortFiles', () => {
  const files = [
    { path: 'F/IMG_10.jpg', modified: 1000 },
    { path: 'F/IMG_2.jpg', modified: 3000, taken: 500 },
    { path: 'F/IMG_1.jpg', modified: 2000 },
  ];

  it('sorts by name like a file manager (2 before 10)', () => {
    expect(sortFiles(files, 'name').map((f) => f.path)).toEqual(['F/IMG_1.jpg', 'F/IMG_2.jpg', 'F/IMG_10.jpg']);
  });

  it('sorts by the EXIF date, or the file date when there is none', () => {
    expect(sortFiles(files, 'date').map((f) => f.path)).toEqual(['F/IMG_2.jpg', 'F/IMG_10.jpg', 'F/IMG_1.jpg']);
  });

  it('breaks date ties by name', () => {
    const same = [{ path: 'b.jpg', modified: 1 }, { path: 'a.jpg', modified: 1 }];
    expect(sortFiles(same, 'date').map((f) => f.path)).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('inChosenFolder', () => {
  it('tells files of the chosen folder from those in its subfolders', () => {
    expect(inChosenFolder('Wakacje/IMG_1.jpg')).toBe(true);
    expect(inChosenFolder('IMG_1.jpg')).toBe(true);
    expect(inChosenFolder('Wakacje/2024/IMG_1.jpg')).toBe(false);
    expect(inChosenFolder('Wakacje/a/b/IMG_1.jpg')).toBe(false);
  });
});

describe('collageCount / clampRange', () => {
  it('gives the possible number of collages', () => {
    expect(collageCount(23, 4, 6)).toEqual({ lo: 4, hi: 5 });
    expect(collageCount(10, 4, 4)).toBeNull();
    expect(collageCount(0, 2, 3)).toEqual({ lo: 0, hi: 0 });
  });

  it('keeps 1 ≤ min ≤ max ≤ 20', () => {
    expect(clampRange(0, 50)).toEqual({ min: 1, max: 20 });
    expect(clampRange(6, 3)).toEqual({ min: 6, max: 6 });
    expect(clampRange(Number.NaN, 4)).toEqual({ min: 1, max: 4 });
  });
});

describe('planBatch', () => {
  it('uses every photo, each collage within the range', async () => {
    for (const [n, min, max] of [
      [23, 4, 6],
      [37, 3, 5],
      [12, 2, 8],
      [50, 6, 9],
    ] as const) {
      const sizes = await planBatch(photos(n), opts(min, max), 1);
      expect(sum(sizes)).toBe(n);
      for (const s of sizes) {
        expect(s).toBeGreaterThanOrEqual(min);
        expect(s).toBeLessThanOrEqual(max);
      }
    }
  });

  it('allows the closest sizes when the range cannot be met', async () => {
    expect(await planBatch(photos(3), opts(4, 6), 1)).toEqual([3]);
    const sizes = await planBatch(photos(10), opts(4, 4), 1);
    expect(sum(sizes)).toBe(10);
    expect(sizes.filter((s) => s !== 4).length).toBeLessThanOrEqual(2);
  });

  it('prefers sizes that make an even grid', async () => {
    // 12 landscape photos as grids of 3–5: 4 + 4 + 4 fills every grid completely.
    expect(await planBatch(photos(12), opts(3, 5, 'grid'), 1)).toEqual([4, 4, 4]);
  });

  it('is deterministic for a seed and reports progress', async () => {
    const ticks: number[] = [];
    const a = await planBatch(photos(30), opts(3, 6), 7, (done) => void ticks.push(done));
    expect(await planBatch(photos(30), opts(3, 6), 7)).toEqual(a);
    expect(ticks.at(-1)).toBe(30);
  });

  it('can be cancelled from the progress callback', async () => {
    await expect(
      planBatch(photos(30), opts(3, 6), 7, () => {
        throw new Error('stop');
      }),
    ).rejects.toThrow('stop');
  });

  it('returns nothing for no photos', async () => {
    expect(await planBatch([], opts(2, 3), 1)).toEqual([]);
  });
});

describe('buildBatch', () => {
  it('makes consecutive collages in order, each with its own key and layout', () => {
    const list = photos(7);
    const docs = buildBatch(list, [3, 4], { mode: 'grid', sheet: { ...DEFAULT_SHEET, gapMm: 2 } }, 5);
    expect(docs.map((d) => d.photos.map((p) => p.id))).toEqual([
      ['p0', 'p1', 'p2'],
      ['p3', 'p4', 'p5', 'p6'],
    ]);
    expect(new Set(docs.map((d) => d.batchKey)).size).toBe(2);
    for (const d of docs) {
      expect(d.mode).toBe('grid');
      expect(d.sheet.gapMm).toBe(2);
      expect(leaves(currentTree(d)).length).toBe(d.photos.length);
    }
  });
});

describe('writeBack', () => {
  const docs = buildBatch(photos(6), [3, 3], { mode: 'auto', sheet: { ...DEFAULT_SHEET } }, 2);

  it('puts the edited collage back, without the magazine', () => {
    const edited = docReducer(docs[1]!, { type: 'toMagazine', photoId: 'p4', seed: 1 });
    const next = writeBack(docs, edited);
    expect(next[0]).toBe(docs[0]);
    expect(next[1]!.photos.map((p) => p.id)).toEqual(['p3', 'p5']);
    expect(next[1]!.magazine).toEqual([]);
  });

  it('leaves the series alone for other documents or no change', () => {
    expect(writeBack(docs, { ...docs[0]!, batchKey: undefined })).toBe(docs);
    expect(writeBack(docs, { ...docs[0]!, batchKey: 'unknown' })).toBe(docs);
    expect(writeBack(docs, docs[0]!)).toBe(docs);
    expect(batchCopy(docs[0]!)).toBe(docs[0]);
  });
});

describe('seriesFileBase', () => {
  it('numbers from 001', () => {
    expect(seriesFileBase('wakacje', 1)).toBe('wakacje_001');
    expect(seriesFileBase('wakacje', 42)).toBe('wakacje_042');
    expect(seriesFileBase('x', 1234)).toBe('x_1234');
  });
});
