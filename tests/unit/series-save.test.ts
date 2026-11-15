import { describe, expect, it } from 'vitest';
import { failureReason, saveSeries, type DirHandle, type SeriesItem } from '../../src/autoCollage';
import { emptyDoc } from '../../src/core/doc';
import { RenderError } from '../../src/exporter';

const items: SeriesItem[] = ['a_001.jpg', 'a_002.jpg', 'a_003.jpg'].map((name) => ({ doc: emptyDoc(), name }));

function folder(written: string[]): DirHandle {
  return {
    name: 'Out',
    getFileHandle: async (name) => ({
      createWritable: async () => ({ write: async () => void written.push(name), close: async () => undefined }),
    }),
  };
}

describe('saveSeries', () => {
  it('keeps going after a failed collage and tries a lack of memory once more', async () => {
    const calls: number[] = [];
    let n = 0;
    const render = async (doc: unknown) => {
      const i = items.findIndex((item) => item.doc === doc);
      calls.push(i);
      if (i === 0 && n++ === 0) throw new RenderError('memory'); // succeeds on the second try
      if (i === 1) throw new RenderError('photo', 'IMG_7.jpg'); // never retried
      return new Blob(['x']);
    };
    const written: string[] = [];
    const { saved, failed } = await saveSeries(items, () => undefined, 150, 'jpeg', 'a.zip', folder(written), () => undefined, render as never);
    expect(calls).toEqual([0, 0, 1, 2]);
    expect(saved).toEqual(['a_001.jpg', 'a_003.jpg']);
    expect(written).toEqual(['a_001.jpg', 'a_003.jpg']);
    expect(failed.map((f) => f.item.name)).toEqual(['a_002.jpg']);
    expect(failed[0]!.reason).toContain('IMG_7.jpg');
  });

  it('explains the failures', () => {
    expect(failureReason(new RenderError('memory'), 'render')).toContain('za mało pamięci');
    expect(failureReason(new DOMException('x', 'QuotaExceededError'), 'write')).toBe('brak miejsca na dysku');
    expect(failureReason(new DOMException('x', 'NotAllowedError'), 'write')).toBe('brak zgody na zapis w tym folderze');
    expect(failureReason(new Error('x'), 'write')).toBe('nie można zapisać pliku');
  });
});
