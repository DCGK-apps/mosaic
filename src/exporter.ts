import { drawMosaic, exportFileName, exportSize, MAX_PIXELS, MAX_PIXELS_IOS, type ExportType } from './core/export';
import { currentTree } from './core/doc';
import type { Doc } from './core/types';
import { download, type SaveTarget } from './download';
import { loadImage } from './images';
import { isIos } from './pwa';

export function maxPixels(): number {
  return isIos(navigator.userAgent, navigator.maxTouchPoints ?? 0) ? MAX_PIXELS_IOS : MAX_PIXELS;
}

/** Why a collage could not be rendered: a photo that cannot be read, or not enough memory for the canvas. */
export class RenderError extends Error {
  constructor(
    readonly kind: 'photo' | 'memory',
    /** The photo's file name (kind "photo"). */
    readonly photo = '',
  ) {
    super(kind === 'photo' ? `Nie można odczytać zdjęcia ${photo}` : 'Za mało pamięci');
  }
}

/** Renders the collage to an image file at the given DPI. */
export async function renderMosaic(doc: Doc, urlOf: (photoId: string) => string | undefined, dpi: number, type: ExportType): Promise<Blob> {
  const size = exportSize(doc.sheet, dpi, maxPixels());
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    doc.photos.map(async (p) => {
      const url = urlOf(p.id);
      if (!url) throw new RenderError('photo', p.name);
      try {
        images.set(p.id, await loadImage(url));
      } catch {
        throw new RenderError('photo', p.name);
      }
    }),
  );
  const canvas = document.createElement('canvas');
  try {
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new RenderError('memory');
    drawMosaic(ctx, { tree: currentTree(doc), sheet: doc.sheet, photos: doc.photos }, images, size.pxPerMm);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, `image/${type}`, 0.95));
    if (!blob) throw new RenderError('memory');
    return blob;
  } finally {
    // Free the memory right away – a series renders many large sheets in a row.
    canvas.width = 0;
    canvas.height = 0;
    for (const img of images.values()) img.src = '';
  }
}

/** Renders the mosaic to an image file and lets the browser download it. */
export async function exportMosaic(doc: Doc, urlOf: (photoId: string) => string | undefined, dpi: number, type: ExportType, name?: string, target?: SaveTarget): Promise<void> {
  const blob = await renderMosaic(doc, urlOf, dpi, type);
  if (target) await target.write(blob);
  else download(blob, exportFileName(doc.sheet, type, name));
}
