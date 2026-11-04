import { describe, expect, it } from 'vitest';
import { drawMosaic, exportFileName, exportSize, MAX_PIXELS_IOS, MAX_SIDE_PX, type DrawContext } from '../../src/core/export';
import type { Sheet } from '../../src/core/types';
import { leaf, photo, split } from './helpers';

function recorder() {
  const calls: unknown[][] = [];
  const ctx = new Proxy(
    { fillStyle: '' },
    {
      get: (target, prop) =>
        prop === 'fillStyle' ? target.fillStyle : (...args: unknown[]) => calls.push([prop, ...args.map((a) => (typeof a === 'number' ? Math.round(a * 100) / 100 : a))]),
      set: (target, prop, value) => {
        if (prop === 'fillStyle') target.fillStyle = value;
        calls.push([`set ${String(prop)}`, value]);
        return true;
      },
    },
  ) as unknown as DrawContext;
  return { ctx, calls };
}

const sheet: Sheet = { widthMm: 100, heightMm: 50, gapMm: 10, radiusMm: 0, frameColor: '#ff0000' };

describe('exportSize', () => {
  it('converts DPI to pixels', () => {
    expect(exportSize({ widthMm: 254, heightMm: 127 }, 100)).toMatchObject({ width: 1000, height: 500, reduced: false });
  });

  it('shrinks to the browser limits, keeping the proportions', () => {
    const s = exportSize({ widthMm: 500, heightMm: 500 }, 300, MAX_PIXELS_IOS);
    expect(s.width * s.height).toBeLessThanOrEqual(MAX_PIXELS_IOS);
    expect(s.width).toBe(s.height);
    expect(s.reduced).toBe(true);
    expect(exportSize({ widthMm: 2000, heightMm: 10 }, 300).width).toBeLessThanOrEqual(MAX_SIDE_PX);
  });

  it('names the file after the sheet size', () => {
    expect(exportFileName({ widthMm: 504, heightMm: 506 }, 'jpeg')).toBe('kolaz_504x506.jpg');
    expect(exportFileName({ widthMm: 210, heightMm: 297 }, 'png')).toBe('kolaz_210x297.png');
  });
});

describe('drawMosaic', () => {
  const tree = split('s', 'V', 0.5, leaf('a'), leaf('b'));
  const photos = [photo('a', 100, 100), photo('b', 100, 100)];
  const images = new Map([
    ['a', {} as CanvasImageSource],
    ['b', {} as CanvasImageSource],
  ]);

  it('fills the frame colour and clips each photo to its cell (same geometry as the preview)', () => {
    const { ctx, calls } = recorder();
    drawMosaic(ctx, { tree, sheet, photos }, images, 2);
    expect(calls[0]).toEqual(['set fillStyle', '#ff0000']);
    expect(calls[1]).toEqual(['fillRect', 0, 0, 200, 100]);
    const rects = calls.filter((c) => c[0] === 'rect');
    expect(rects).toEqual([
      ['rect', 0, 0, 90, 100],
      ['rect', 110, 0, 90, 100],
    ]);
    // Square photo in a 45×50 mm cell: covers it at 50×50 mm, centred.
    expect(calls.filter((c) => c[0] === 'drawImage').map((c) => c.slice(2))).toEqual([
      [-5, 0, 100, 100],
      [105, 0, 100, 100],
    ]);
  });

  it('uses rounded corners when set, and skips photos without an image', () => {
    const { ctx, calls } = recorder();
    drawMosaic(ctx, { tree, sheet: { ...sheet, radiusMm: 4 }, photos }, new Map([['a', {} as CanvasImageSource]]), 1);
    expect(calls.filter((c) => c[0] === 'roundRect')).toEqual([['roundRect', 0, 0, 45, 50, 4]]);
    expect(calls.filter((c) => c[0] === 'drawImage')).toHaveLength(1);
  });
});
