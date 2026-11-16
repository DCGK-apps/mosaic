import { imageRect } from './crop';
import { cellRadius, computeLayout } from './geometry';
import { fontCss, layoutText, REF_PX, SHADOW, type Measure, type TextBox } from './text';
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
  | 'fillStyle' | 'fillRect' | 'save' | 'restore' | 'beginPath' | 'rect' | 'roundRect' | 'clip' | 'drawImage'
  | 'font' | 'fillText' | 'measureText' | 'textAlign' | 'textBaseline' | 'translate' | 'rotate'
  | 'shadowColor' | 'shadowBlur' | 'shadowOffsetX' | 'shadowOffsetY'
>;

/** Text measuring with a canvas context – the same for the preview and the export. */
export function canvasMeasure(ctx: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>): Measure {
  return (text, font) => {
    ctx.font = font;
    const m = ctx.measureText(text);
    // Older browsers have no font metrics – typical values instead.
    const ascent = Number.isFinite(m.fontBoundingBoxAscent) ? m.fontBoundingBoxAscent : REF_PX * 0.9;
    const descent = Number.isFinite(m.fontBoundingBoxDescent) ? m.fontBoundingBoxDescent : REF_PX * 0.25;
    return { width: m.width, ascent, descent };
  };
}

/** Draws the captions above the photos; positions come from layoutText(), like in the preview. */
export function drawTexts(ctx: DrawContext, texts: readonly TextBox[], sheet: Sheet, pxPerMm: number): void {
  const s = pxPerMm;
  const measure = canvasMeasure(ctx);
  for (const t of texts) {
    if (!t.text.trim()) continue;
    const l = layoutText(t, sheet, measure);
    ctx.save();
    ctx.translate(l.cx * s, l.cy * s);
    const angle = (t.rotation * Math.PI) / 180;
    ctx.rotate(angle);
    ctx.translate((-l.w / 2) * s, (-l.h / 2) * s);
    ctx.font = fontCss(t, t.sizeMm * s);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = t.color;
    if (t.shadow) {
      // The canvas shadow ignores the rotation; turn the offset by hand, as CSS does.
      const o = SHADOW.offset * t.sizeMm * s;
      ctx.shadowColor = SHADOW.color;
      ctx.shadowBlur = SHADOW.blur * t.sizeMm * s;
      ctx.shadowOffsetX = o * Math.cos(angle) - o * Math.sin(angle);
      ctx.shadowOffsetY = o * Math.sin(angle) + o * Math.cos(angle);
    }
    for (const line of l.lines) {
      if (!line.text) continue;
      ctx.fillText(line.text, line.x * s, line.baseline * s);
      if (t.underline) ctx.fillRect(line.x * s, (line.baseline + l.underline.offset) * s, line.width * s, l.underline.thickness * s);
    }
    ctx.restore();
  }
}

/** Draws the mosaic exactly like the preview – both use computeLayout() and imageRect(). */
export function drawMosaic(
  ctx: DrawContext,
  doc: { tree: Node | null; sheet: Sheet; photos: Photo[]; texts?: readonly TextBox[] },
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
  if (doc.texts?.length) drawTexts(ctx, doc.texts, doc.sheet, s);
}

export const exportExt = (type: ExportType): string => (type === 'png' ? '.png' : '.jpg');

/** Default name (without the extension); it ends with a letter so the size is not taken for a counter. */
export function defaultFileBase(sheet: Pick<Sheet, 'widthMm' | 'heightMm'>): string {
  return `kolaz_${sheet.widthMm}x${sheet.heightMm}mm`;
}

export function exportFileName(sheet: Pick<Sheet, 'widthMm' | 'heightMm'>, type: ExportType, base = defaultFileBase(sheet)): string {
  return base + exportExt(type);
}
