import { imageRect } from './crop';
import { cellRadius, computeLayout } from './geometry';
import type { Node, Photo, Sheet } from './types';

export const DPI_OPTIONS = [100, 150, 300] as const;
export const DEFAULT_DPI = 150;
export type ExportType = 'jpeg' | 'png';

/** Largest canvas every browser can create (iOS Safari's limit is 16.7 Mpx). */
export const MAX_PIXELS_IOS = 16_777_216;
export const MAX_PIXELS = 64_000_000;
export const MAX_SIDE_PX = 16_384;

export interface ExportSize {
  width: number;
  height: number;
  pxPerMm: number;
  /** True when the requested DPI did not fit the browser's limits. */
  reduced: boolean;
}

export function exportSize(sheet: Pick<Sheet, 'widthMm' | 'heightMm'>, dpi: number, maxPixels = MAX_PIXELS): ExportSize {
  let pxPerMm = dpi / 25.4;
  const fit = Math.min(
    1,
    Math.sqrt(maxPixels / (sheet.widthMm * pxPerMm * sheet.heightMm * pxPerMm)),
    MAX_SIDE_PX / (sheet.widthMm * pxPerMm),
    MAX_SIDE_PX / (sheet.heightMm * pxPerMm),
  );
  pxPerMm *= fit;
  // Rounded to the nearest pixel – but never above the limit when it was reduced.
  const px = (mm: number) => Math.max(1, fit < 1 ? Math.floor(mm * pxPerMm) : Math.round(mm * pxPerMm));
  return {
    width: px(sheet.widthMm),
    height: px(sheet.heightMm),
    pxPerMm,
    reduced: fit < 1,
  };
}

export type DrawContext = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'fillRect' | 'save' | 'restore' | 'beginPath' | 'rect' | 'roundRect' | 'clip' | 'drawImage'
>;

/** Draws the mosaic exactly like the preview – both use computeLayout() and imageRect(). */
export function drawMosaic(
  ctx: DrawContext,
  doc: { tree: Node | null; sheet: Sheet; photos: Photo[] },
  images: ReadonlyMap<string, CanvasImageSource>,
  pxPerMm: number,
): void {
  const s = pxPerMm;
  ctx.fillStyle = doc.sheet.frameColor;
  ctx.fillRect(0, 0, doc.sheet.widthMm * s, doc.sheet.heightMm * s);
  const photos = new Map(doc.photos.map((p) => [p.id, p]));
  for (const cell of computeLayout(doc.tree, doc.sheet).cells) {
    const photo = photos.get(cell.photoId);
    const img = images.get(cell.photoId);
    if (!photo || !img || cell.w <= 0 || cell.h <= 0) continue;
    const r = imageRect(photo, cell);
    ctx.save();
    ctx.beginPath();
    const radius = cellRadius(doc.sheet.radiusMm, cell) * s;
    if (radius > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(cell.x * s, cell.y * s, cell.w * s, cell.h * s, radius);
    else ctx.rect(cell.x * s, cell.y * s, cell.w * s, cell.h * s);
    ctx.clip();
    ctx.drawImage(img, r.x * s, r.y * s, r.w * s, r.h * s);
    ctx.restore();
  }
}

export function exportFileName(sheet: Pick<Sheet, 'widthMm' | 'heightMm'>, type: ExportType): string {
  return `kolaz_${sheet.widthMm}x${sheet.heightMm}.${type === 'png' ? 'png' : 'jpg'}`;
}
