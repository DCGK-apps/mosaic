import { describe, expect, it } from 'vitest';
import { docReducer, emptyDoc } from '../../src/core/doc';
import { isProjectFile, ProjectError, projectFileName, readProject, writeProject } from '../../src/storage/project';
import { restoreDoc } from '../../src/storage/serialize';
import { photo } from './helpers';

const sample = () => {
  let doc = docReducer(emptyDoc(), { type: 'addPhotos', photos: [photo('a'), photo('b', 300, 500), photo('c')], seed: 3 });
  doc = docReducer(doc, { type: 'toMagazine', photoId: 'c', seed: 1 });
  doc = docReducer(doc, { type: 'setCrop', photoId: 'a', crop: { x: 0.2, y: -0.4, zoom: 1.5 } });
  return docReducer(doc, { type: 'setSheet', patch: { gapMm: 7, radiusMm: 3, frameColor: '#123456' } });
};

const blobs = new Map([
  ['a', new Blob(['AAAA'], { type: 'image/jpeg' })],
  ['b', new Blob(['BBBBBBBB'], { type: 'image/png' })],
  ['c', new Blob(['C'], { type: 'image/webp' })],
]);

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

describe('project file', () => {
  it('round-trips the document and every photo, magazine included', async () => {
    const doc = sample();
    const file = writeProject(doc, (id) => blobs.get(id));
    const { saved, images } = await readProject(file);
    expect(restoreDoc(saved, (id) => images.has(id))).toEqual(doc);
    expect([...images.keys()]).toEqual(['a', 'b', 'c']);
    for (const [id, blob] of blobs) {
      expect(images.get(id)!.type).toBe(blob.type);
      expect(await bytes(images.get(id)!)).toEqual(await bytes(blob));
    }
  });

  it('leaves out photos without a file – restoreDoc then closes their gap', async () => {
    const { saved, images } = await readProject(writeProject(sample(), (id) => (id === 'b' ? undefined : blobs.get(id))));
    expect([...images.keys()]).toEqual(['a', 'c']);
    expect(restoreDoc(saved, (id) => images.has(id))!.photos.map((p) => p.id)).toEqual(['a']);
  });

  it('rejects files that are not projects', async () => {
    await expect(readProject(new Blob(['hello']))).rejects.toThrow(ProjectError);
    await expect(readProject(new Blob(['\xff\xd8\xff\xe0 a jpeg file, not a project']))).rejects.toThrow('To nie jest plik projektu Mosaic');
  });

  it('rejects damaged projects', async () => {
    const good = await bytes(writeProject(sample(), (id) => blobs.get(id)));
    // Cut off in the middle of the photos.
    await expect(readProject(new Blob([good.slice(0, good.length - 3)]))).rejects.toThrow('uszkodzony');
    // Manifest length pointing past the end.
    const long = good.slice();
    new DataView(long.buffer).setUint32(8, 0xffffff, true);
    await expect(readProject(new Blob([long]))).rejects.toThrow('uszkodzony');
    // Broken JSON.
    const broken = good.slice();
    broken[12] = 0x7b + 1;
    await expect(readProject(new Blob([broken]))).rejects.toThrow('uszkodzony');
  });

  it('names the file after the sheet and recognises the extension', () => {
    expect(projectFileName(sample())).toBe('kolaz_504x506.mosaic');
    expect(isProjectFile({ name: 'Wakacje.MOSAIC' })).toBe(true);
    expect(isProjectFile({ name: 'zdjecie.jpg' })).toBe(false);
  });
});
