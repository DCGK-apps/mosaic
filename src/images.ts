/** Browser side of photos: reading files and turning stored blobs back into images. */

export interface ImageEntry {
  blob: Blob;
  url: string;
  /** Small preview (photos of an automatic series), for the collage thumbnails. */
  thumb?: { blob: Blob; url: string };
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Nie udało się wczytać obrazu'));
    img.src = url;
  });
}

/** Natural size of an image blob; also checks that the browser can decode it. */
export async function readImage(blob: Blob): Promise<{ url: string; width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    return { url, width: img.naturalWidth, height: img.naturalHeight };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Longest side of a photo preview, in pixels. */
export const THUMB_SIDE = 240;

/** A small JPEG preview of a loaded image. */
export async function makeThumb(img: HTMLImageElement): Promise<Blob | null> {
  const scale = Math.min(1, THUMB_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}

/** Like readImage, plus a small preview; the image is decoded once. */
export async function readImageWithThumb(blob: Blob): Promise<ImageEntry & { width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const thumbBlob = await makeThumb(img).catch(() => null);
    return {
      blob,
      url,
      width: img.naturalWidth,
      height: img.naturalHeight,
      ...(thumbBlob ? { thumb: { blob: thumbBlob, url: URL.createObjectURL(thumbBlob) } } : {}),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}
