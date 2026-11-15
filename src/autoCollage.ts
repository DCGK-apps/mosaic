/**
 * Browser side of the automatic series ("Kolaże z folderu"): reading a folder
 * of photos and saving all the collages at once. The planning itself is in
 * core/batch.ts.
 */
import { buildBatch, MAX_BATCH_PHOTOS, planBatch, seriesFileBase, sortFiles, type BatchOptions, type BatchOrder } from './core/batch';
import { DEFAULT_CROP } from './core/crop';
import { exportExt, type ExportType } from './core/export';
import { EXIF_BYTES, exifDate } from './core/exif';
import { randomSeed } from './core/random';
import type { Doc, Photo } from './core/types';
import { zipParts } from './core/zip';
import { download } from './download';
import { renderMosaic } from './exporter';
import { readImageWithThumb, type ImageEntry } from './images';
import { newPhotoId } from './hooks/useMosaic';

export class Cancelled extends Error {}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

/** Photos among the files of a chosen folder (hidden files like ".DS_Store" are skipped). */
export function photoFiles(files: Iterable<File>): File[] {
  return [...files].filter((f) => !f.name.startsWith('.') && (f.type.startsWith('image/') ? !/heic|heif|tiff/i.test(f.type) : IMAGE_EXT.test(f.name)));
}

/** Path of the file inside the chosen folder (the folder name included). */
export const pathOf = (f: File) => f.webkitRelativePath || f.name;

/** Name of the chosen folder. */
export const folderName = (files: readonly File[]) => (files[0] ? pathOf(files[0]).split('/')[0] ?? '' : '');

/** Runs `fn` over `items`, `limit` at a time, keeping the order of results. */
async function pool<T, R>(items: readonly T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = Array.from<R>({ length: items.length });
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}

async function takenAt(file: File): Promise<number | undefined> {
  if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return undefined;
  try {
    return exifDate(await file.slice(0, EXIF_BYTES).arrayBuffer());
  } catch {
    return undefined;
  }
}

export interface Progress {
  stage: 'read' | 'plan';
  done: number;
  total: number;
}

export interface SeriesResult {
  docs: Doc[];
  entries: Map<string, ImageEntry>;
  /** Files that could not be read as images. */
  skipped: number;
}

/** Reads the photos, splits them into collages and lays each one out. */
export async function createSeries(
  files: readonly File[],
  order: BatchOrder,
  opts: BatchOptions,
  onProgress: (p: Progress) => void,
  cancelled: () => boolean,
): Promise<SeriesResult> {
  const check = () => {
    if (cancelled()) throw new Cancelled();
  };
  const infos = await pool(files, 8, async (file) => ({ file, path: pathOf(file), modified: file.lastModified, taken: await takenAt(file) }));
  check();
  const sorted = sortFiles(infos, order).slice(0, MAX_BATCH_PHOTOS);

  let read = 0;
  const loaded = await pool(sorted, 4, async ({ file }) => {
    check();
    try {
      const entry = await readImageWithThumb(file);
      return { file, entry };
    } catch {
      return null;
    } finally {
      onProgress({ stage: 'read', done: ++read, total: sorted.length });
    }
  });
  const entries = new Map<string, ImageEntry>();
  const photos: Photo[] = [];
  for (const item of loaded) {
    if (!item) continue;
    const id = newPhotoId();
    const { width, height, ...entry } = item.entry;
    entries.set(id, entry);
    photos.push({ id, name: item.file.name, width, height, crop: { ...DEFAULT_CROP } });
  }
  const free = () => {
    for (const e of entries.values()) {
      URL.revokeObjectURL(e.url);
      if (e.thumb) URL.revokeObjectURL(e.thumb.url);
    }
  };

  try {
    const seed = randomSeed();
    let last = 0;
    const sizes = await planBatch(photos, opts, seed, async (done, total) => {
      check();
      const now = performance.now();
      if (now - last < 50) return;
      last = now;
      onProgress({ stage: 'plan', done, total });
      await new Promise((r) => setTimeout(r, 0));
    });
    check();
    return { docs: buildBatch(photos, sizes, opts, seed), entries, skipped: sorted.length - photos.length };
  } catch (e) {
    free();
    throw e;
  }
}

// --- Saving the whole series --------------------------------------------------

/** The parts of the File System Access API used here (Chrome and Edge on a computer). */
interface WritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface FileHandle {
  createWritable(): Promise<WritableFile>;
}
export interface DirHandle {
  name: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle>;
}
type PickDir = (opts?: { mode?: 'readwrite'; id?: string }) => Promise<DirHandle>;

/** True when the browser can write the files into a folder the user chooses. */
export function canPickFolder(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/** Asks for the folder to save into; null when the user closed the window. */
export async function pickFolder(): Promise<DirHandle | null> {
  try {
    return await (window as unknown as { showDirectoryPicker: PickDir }).showDirectoryPicker({ mode: 'readwrite', id: 'mosaic-series' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

/** Names from the list that already exist in the folder. */
export async function existingNames(dir: DirHandle, names: readonly string[]): Promise<string[]> {
  const found: string[] = [];
  for (const name of names) {
    try {
      await dir.getFileHandle(name);
      found.push(name);
    } catch {
      /* not there */
    }
  }
  return found;
}

/** File names of the series: "wakacje_001.jpg", "wakacje_002.jpg"… */
export function seriesNames(base: string, count: number, type: ExportType): string[] {
  return Array.from({ length: count }, (_, i) => seriesFileBase(base, i + 1) + exportExt(type));
}

/**
 * Renders every collage and writes it into `dir` – or, without a folder, packs
 * them into one ZIP file that the browser downloads.
 */
export async function saveSeries(
  docs: readonly Doc[],
  urlOf: (photoId: string) => string | undefined,
  dpi: number,
  type: ExportType,
  base: string,
  dir: DirHandle | null,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const names = seriesNames(base, docs.length, type);
  const zip: { name: string; data: Uint8Array }[] = [];
  for (const [i, doc] of docs.entries()) {
    onProgress(i, docs.length);
    const blob = await renderMosaic(doc, urlOf, dpi, type);
    if (dir) {
      const file = await (await dir.getFileHandle(names[i]!, { create: true })).createWritable();
      await file.write(blob);
      await file.close();
    } else {
      zip.push({ name: names[i]!, data: new Uint8Array(await blob.arrayBuffer()) });
    }
  }
  onProgress(docs.length, docs.length);
  if (!dir) download(new Blob(zipParts(zip) as BlobPart[], { type: 'application/zip' }), `${base}.zip`);
}
