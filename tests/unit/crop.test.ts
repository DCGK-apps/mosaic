import { describe, expect, it } from 'vitest';
import { drawnSize, imageRect, panCrop, setZoom, ZOOM_MAX } from '../../src/core/crop';

const cell = { x: 10, y: 20, w: 100, h: 100 };
const wide = { width: 200, height: 100 };

describe('crop', () => {
  it('covers the cell (no empty space) and zoom magnifies further', () => {
    expect(drawnSize(wide, cell, 1)).toEqual({ w: 200, h: 100 });
    expect(drawnSize(wide, cell, 2)).toEqual({ w: 400, h: 200 });
    expect(drawnSize(wide, cell, 0.5)).toEqual({ w: 200, h: 100 }); // zoom below 100% would leave gaps
  });

  it('centres the photo by default and moves it within the overflow', () => {
    expect(imageRect({ ...wide, crop: { x: 0, y: 0, zoom: 1 } }, cell)).toEqual({ x: -40, y: 20, w: 200, h: 100 });
    expect(imageRect({ ...wide, crop: { x: 1, y: 0, zoom: 1 } }, cell).x).toBe(10); // left edge at the cell edge
    expect(imageRect({ ...wide, crop: { x: -1, y: 0, zoom: 1 } }, cell).x).toBe(-90); // right edge at the cell edge
  });

  it('the photo always covers the cell, whatever the crop', () => {
    for (const crop of [
      { x: 5, y: -5, zoom: 1 },
      { x: -1, y: 1, zoom: 3 },
      { x: 0.3, y: 0.7, zoom: 1.7 },
    ]) {
      const r = imageRect({ ...wide, crop }, cell);
      expect(r.x).toBeLessThanOrEqual(cell.x + 1e-9);
      expect(r.y).toBeLessThanOrEqual(cell.y + 1e-9);
      expect(r.x + r.w).toBeGreaterThanOrEqual(cell.x + cell.w - 1e-9);
      expect(r.y + r.h).toBeGreaterThanOrEqual(cell.y + cell.h - 1e-9);
    }
  });

  it('panning follows the finger and stops at the photo edge', () => {
    const start = { x: 0, y: 0, zoom: 1 };
    const moved = panCrop(start, wide, cell, 25, 30);
    expect(moved.x).toBe(0.5); // overflow is 50 on each side
    expect(moved.y).toBe(0); // nothing to move vertically
    expect(panCrop(start, wide, cell, 500, 0).x).toBe(1);
    const zoomed = panCrop({ x: 0, y: 0, zoom: 2 }, wide, cell, 0, -25);
    expect(zoomed.y).toBe(-0.5);
  });

  it('zoom is kept between 100% and 300%, in whole percent', () => {
    expect(setZoom({ x: 0, y: 0, zoom: 1 }, 1.234).zoom).toBe(1.23);
    expect(setZoom({ x: 0, y: 0, zoom: 1 }, 0.2).zoom).toBe(1);
    expect(setZoom({ x: 0, y: 0, zoom: 1 }, 9).zoom).toBe(ZOOM_MAX);
  });
});
