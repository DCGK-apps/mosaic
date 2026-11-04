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
