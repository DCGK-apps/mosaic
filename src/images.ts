/** Browser side of photos: reading files and turning stored blobs back into images. */

export interface ImageEntry {
  blob: Blob;
  url: string;
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
