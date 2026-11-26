import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { currentTree, docReducer, emptyDoc } from '../../src/core/doc';
import { leaves } from '../../src/core/tree';
import { MosaicDb } from '../../src/storage/db';
import { restoreDoc, toSaved } from '../../src/storage/serialize';
import { photo } from './helpers';

const sample = () => {
  let doc = docReducer(emptyDoc(), { type: 'addPhotos', photos: [photo('a'), photo('b', 300, 500), photo('c')], seed: 3 });
  doc = docReducer(doc, { type: 'toMagazine', photoId: 'c', seed: 1 });
  doc = docReducer(doc, { type: 'setCrop', photoId: 'a', crop: { x: 0.2, y: -0.4, zoom: 1.5 } });
  return docReducer(doc, { type: 'setSheet', patch: { gapMm: 7, frameColor: '#123456' } });
};

describe('restoreDoc', () => {
  it('round-trips a document through JSON', () => {
    const doc = sample();
    const raw = JSON.parse(JSON.stringify(toSaved(doc)));
    expect(restoreDoc(raw, () => true)).toEqual(doc);
  });

  it('leaves out photos whose image is gone and closes their gap', () => {
    const restored = restoreDoc(toSaved(sample()), (id) => id !== 'a')!;
    expect(restored.photos.map((p) => p.id)).toEqual(['b']);
    expect(restored.magazine.map((p) => p.id)).toEqual(['c']);
    expect(leaves(currentTree(restored)).map((l) => l.photoId)).toEqual(['b']);
  });

  it('rejects foreign data and repairs broken fields', () => {
    expect(restoreDoc(null, () => true)).toBeNull();
    expect(restoreDoc({ version: 99, doc: {} }, () => true)).toBeNull();
    const repaired = restoreDoc({ version: 1, doc: { mode: 'weird', sheet: { widthMm: -5, frameColor: 'red' }, photos: [{ id: 'x' }], autoIndex: 7 } }, () => true)!;
    expect(repaired.mode).toBe('auto');
    expect(repaired.sheet.widthMm).toBe(10);
    expect(repaired.sheet.frameColor).toBe('#ffffff');
    expect(repaired.photos).toEqual([]);
    expect(repaired.autoIndex).toBe(0);
    expect(repaired.sheet.outerFrame).toBe(false);
  });

  it('keeps the frame around the collage', () => {
    const doc = docReducer(sample(), { type: 'setSheet', patch: { outerFrame: true } });
    expect(restoreDoc(JSON.parse(JSON.stringify(toSaved(doc))), () => true)!.sheet.outerFrame).toBe(true);
  });
});

describe('MosaicDb', () => {
  it('stores the document and the image files', async () => {
    const db = await MosaicDb.open(`test-${Math.random()}`);
    expect(await db.loadDoc()).toBeUndefined();
    await db.saveDoc(toSaved(sample()));
    await db.putImage('a', new Blob(['aaa'], { type: 'image/jpeg' }));
    await db.putImage('b', new Blob(['bb'], { type: 'image/jpeg' }));
    expect(restoreDoc(await db.loadDoc(), () => true)).toEqual(sample());
    await db.deleteImages(['a']);
    const images = await db.loadImages();
    expect([...images.keys()]).toEqual(['b']);
    expect(images.get('b')!.size).toBe(2);
    db.close();
  });
});

describe('series storage', () => {
  it('round-trips the collages of a series, dropping broken and empty ones', async () => {
    const { buildBatch } = await import('../../src/core/batch');
    const { restoreBatch, toSavedBatch } = await import('../../src/storage/serialize');
    const docs = buildBatch([photo('a'), photo('b'), photo('c')], [2, 1], { mode: 'auto', sheet: emptyDoc().sheet }, 4);
    const raw = JSON.parse(JSON.stringify(toSavedBatch(docs)));
    expect(restoreBatch(raw, () => true)).toEqual(docs);
    expect(restoreBatch(raw, (id) => id !== 'c').length).toBe(1);
    expect(restoreBatch({ version: 99, docs: [] }, () => true)).toEqual([]);
    expect(restoreBatch(undefined, () => true)).toEqual([]);
  });

  it('keeps the series and photo previews in the database', async () => {
    const db = await MosaicDb.open(`test-${Math.random()}`);
    expect(await db.loadBatch()).toBeUndefined();
    await db.saveBatch({ version: 1, docs: [] });
    expect(await db.loadBatch()).toEqual({ version: 1, docs: [] });
    await db.putThumb('a', new Blob(['t']));
    await db.putThumb('b', new Blob(['tt']));
    await db.deleteThumbs(['a']);
    expect([...(await db.loadThumbs()).keys()]).toEqual(['b']);
    db.close();
  });
});
