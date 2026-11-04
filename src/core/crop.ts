import type { Crop, Rect } from './types';

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;

export const DEFAULT_CROP: Crop = { x: 0, y: 0, zoom: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Size {
  width: number;
  height: number;
}

/** Size of the photo drawn in a cell: covers the cell, then magnified by `zoom`. */
export function drawnSize(photo: Size, cell: Rect, zoom: number): { w: number; h: number } {
  if (photo.width <= 0 || photo.height <= 0 || cell.w <= 0 || cell.h <= 0) return { w: cell.w, h: cell.h };
  const cover = Math.max(cell.w / photo.width, cell.h / photo.height);
  const z = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
  return { w: photo.width * cover * z, h: photo.height * cover * z };
}

/** Where the photo is drawn (same units as `cell`). Always covers the cell completely. */
export function imageRect(photo: Size & { crop: Crop }, cell: Rect): Rect {
  const { w, h } = drawnSize(photo, cell, photo.crop.zoom);
  const overX = (w - cell.w) / 2;
  const overY = (h - cell.h) / 2;
  return {
    x: cell.x - overX + clamp(photo.crop.x, -1, 1) * overX,
    y: cell.y - overY + clamp(photo.crop.y, -1, 1) * overY,
    w,
    h,
  };
}

/** Moves the photo by (dx, dy) in cell units, stopping at the photo's edges. */
export function panCrop(crop: Crop, photo: Size, cell: Rect, dx: number, dy: number): Crop {
  const { w, h } = drawnSize(photo, cell, crop.zoom);
  const overX = (w - cell.w) / 2;
  const overY = (h - cell.h) / 2;
  return {
    ...crop,
    x: overX > 1e-9 ? clamp(crop.x + dx / overX, -1, 1) : 0,
    y: overY > 1e-9 ? clamp(crop.y + dy / overY, -1, 1) : 0,
  };
}

export function setZoom(crop: Crop, zoom: number): Crop {
  return { ...crop, zoom: Math.round(clamp(zoom, ZOOM_MIN, ZOOM_MAX) * 100) / 100 };
}
