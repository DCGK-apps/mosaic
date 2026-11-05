import { drawMosaic, exportFileName, exportSize, MAX_PIXELS, MAX_PIXELS_IOS, type ExportType } from './core/export';
import { currentTree } from './core/doc';
import type { Doc } from './core/types';
import { download } from './download';
import { loadImage } from './images';
import { isIos } from './pwa';

export function maxPixels(): number {
  return isIos(navigator.userAgent, navigator.maxTouchPoints ?? 0) ? MAX_PIXELS_IOS : MAX_PIXELS;
}

/** Renders the mosaic to an image file and lets the browser download it. */
export async function exportMosaic(doc: Doc, urlOf: (photoId: string) => string | undefined, dpi: number, type: ExportType): Promise<void> {
  const size = exportSize(doc.sheet, dpi, maxPixels());
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    doc.photos.map(async (p) => {
      const url = urlOf(p.id);
      if (url) images.set(p.id, await loadImage(url));
    }),
  );
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Brak obsługi canvas');
  drawMosaic(ctx, { tree: currentTree(doc), sheet: doc.sheet, photos: doc.photos }, images, size.pxPerMm);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, `image/${type}`, 0.95));
  if (!blob) throw new Error('Nie udało się zapisać obrazu');
  download(blob, exportFileName(doc.sheet, type));
}
