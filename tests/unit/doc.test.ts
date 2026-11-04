import { describe, expect, it } from 'vitest';
import { currentTree, docReducer, emptyDoc, MAX_GAP_MM, type DocAction } from '../../src/core/doc';
import { leaves, splits } from '../../src/core/tree';
import type { Doc } from '../../src/core/types';
import { photo } from './helpers';

const run = (doc: Doc, ...actions: DocAction[]) => actions.reduce(docReducer, doc);
const shown = (doc: Doc) => leaves(currentTree(doc)).map((l) => l.photoId).toSorted();
const withPhotos = (n: number, mode: Doc['mode'] = 'auto') =>
  run({ ...emptyDoc(), mode }, { type: 'addPhotos', photos: Array.from({ length: n }, (_, i) => photo(`p${i}`, 300 + 50 * i, 300)), seed: 1 });

describe('docReducer', () => {
  it('adding photos lays them out in the current mode', () => {
    const doc = withPhotos(3);
    expect(shown(doc)).toEqual(['p0', 'p1', 'p2']);
    expect(doc.autoHistory).toHaveLength(1);
    const grid = withPhotos(4, 'grid');
    expect(grid.tree).not.toBeNull();
    expect(shown(grid)).toHaveLength(4);
    expect(run(doc, { type: 'addPhotos', photos: [], seed: 2 })).toBe(doc);
  });

  it('“Losuj nowy” adds a layout you can step back and forth through', () => {
    let doc = run(withPhotos(4), { type: 'shuffle', seed: 2 }, { type: 'shuffle', seed: 3 });
    expect(doc.autoHistory).toHaveLength(3);
    expect(doc.autoIndex).toBe(2);
    doc = run(doc, { type: 'autoStep', delta: -1 });
    expect(doc.autoIndex).toBe(1);
    expect(currentTree(doc)).toBe(doc.autoHistory[1]);
    expect(run(doc, { type: 'autoStep', delta: -5 }).autoIndex).toBe(0);
    expect(run(doc, { type: 'autoStep', delta: 9 }).autoIndex).toBe(2);
  });

  it('switching modes and back to auto keeps the drawn layouts', () => {
    const auto = run(withPhotos(4), { type: 'shuffle', seed: 2 });
    const grid = run(auto, { type: 'setMode', mode: 'grid', seed: 5 });
    expect(grid.tree).not.toBeNull();
    const back = run(grid, { type: 'setMode', mode: 'auto', seed: 6 });
    expect(back.autoHistory).toBe(auto.autoHistory);
    expect(back.autoIndex).toBe(1);
    // …unless the photos changed in the meantime.
    const changed = run(grid, { type: 'addPhotos', photos: [photo('new')], seed: 7 }, { type: 'setMode', mode: 'auto', seed: 8 });
    expect(changed.autoHistory).toHaveLength(1);
    expect(shown(changed)).toContain('new');
  });

  it('moving a divider changes only the current layout (also the auto entry)', () => {
    const doc = run(withPhotos(3), { type: 'shuffle', seed: 2 });
    const split = splits(currentTree(doc))[0]!;
    const next = run(doc, { type: 'setFrac', splitId: split.id, frac: 0.7 });
    expect(splits(currentTree(next))[0]!.frac).toBe(0.7);
    expect(next.autoHistory[0]).toBe(doc.autoHistory[0]);
  });

  it('putting a photo aside keeps the rest of an auto layout; restoring brings it back', () => {
    const doc = withPhotos(4);
    const before = splits(currentTree(doc)).length;
    const aside = run(doc, { type: 'toMagazine', photoId: 'p2', seed: 9 });
    expect(shown(aside)).toEqual(['p0', 'p1', 'p3']);
    expect(aside.magazine.map((p) => p.id)).toEqual(['p2']);
    expect(splits(currentTree(aside))).toHaveLength(before - 1);
    const back = run(aside, { type: 'fromMagazine', photoId: 'p2', seed: 9 });
    expect(shown(back)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(back.magazine).toEqual([]);
    expect(run(aside, { type: 'deleteFromMagazine', photoId: 'p2' }).magazine).toEqual([]);
  });

  it('the last photo put aside leaves an empty sheet', () => {
    const doc = run(withPhotos(1), { type: 'toMagazine', photoId: 'p0', seed: 1 });
    expect(currentTree(doc)).toBeNull();
    expect(doc.photos).toEqual([]);
  });

  it('swapping exchanges the photos of two cells', () => {
    const doc = withPhotos(2, 'cols');
    const [a, b] = leaves(doc.tree);
    const next = run(doc, { type: 'swap', leafA: a!.id, leafB: b!.id });
    expect(leaves(next.tree).map((l) => l.photoId)).toEqual([b!.photoId, a!.photoId]);
  });

  it('crop belongs to the photo; an identical crop changes nothing', () => {
    const doc = withPhotos(2);
    const next = run(doc, { type: 'setCrop', photoId: 'p1', crop: { x: 0.5, y: 0, zoom: 2 } });
    expect(next.photos[1]!.crop).toEqual({ x: 0.5, y: 0, zoom: 2 });
    expect(run(next, { type: 'setCrop', photoId: 'p1', crop: { x: 0.5, y: 0, zoom: 2 } })).toBe(next);
  });

  it('sheet values are kept in range; rotating swaps the sides', () => {
    const doc = run(emptyDoc(), { type: 'setSheet', patch: { widthMm: 1, gapMm: 999, radiusMm: -3 } });
    expect(doc.sheet).toMatchObject({ widthMm: 10, gapMm: MAX_GAP_MM, radiusMm: 0 });
    const rotated = run({ ...emptyDoc(), sheet: { ...emptyDoc().sheet, widthMm: 210, heightMm: 297 } }, { type: 'rotateSheet' });
    expect(rotated.sheet).toMatchObject({ widthMm: 297, heightMm: 210 });
    expect(run(doc, { type: 'setSheet', patch: { gapMm: MAX_GAP_MM } })).toBe(doc);
  });
});
