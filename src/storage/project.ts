/**
 * Project file (`.mosaic`): everything needed to keep editing a collage later –
 * the document (layout, crops, sheet, magazine) and the original photo files.
 *
 * Layout of the file:
 *   8 bytes   "MOSAICP1" (magic + format version)
 *   4 bytes   length of the manifest in bytes, little-endian uint32
 *   n bytes   manifest, UTF-8 JSON: { saved: SavedDoc, images: [{ id, type, size }] }
 *   …         the image files, one after another, in the manifest's order
 *
 * The images are stored as they were added (no re-encoding, no base64), and
 * both writing and reading work on Blob slices, so big projects are not
 * copied around in memory.
 */
import type { Doc } from '../core/types';
import { toSaved } from './serialize';

export const PROJECT_EXT = '.mosaic';
export const PROJECT_MIME = 'application/octet-stream';
const MAGIC = 'MOSAICP1';
const HEADER = MAGIC.length + 4;
const MAX_MANIFEST = 64 * 1024 * 1024;

interface ImageInfo {
  id: string;
  type: string;
  size: number;
}

export class ProjectError extends Error {}

/** Packs the document and the photo files it uses (sheet and magazine) into one file. */
export function writeProject(doc: Doc, blobOf: (photoId: string) => Blob | undefined): Blob {
  const images: ImageInfo[] = [];
  const blobs: Blob[] = [];
  for (const p of [...doc.photos, ...doc.magazine]) {
    const blob = blobOf(p.id);
    if (!blob || images.some((i) => i.id === p.id)) continue;
    images.push({ id: p.id, type: blob.type, size: blob.size });
    blobs.push(blob);
  }
  const manifest = new TextEncoder().encode(JSON.stringify({ saved: toSaved(doc), images }));
  const header = new Uint8Array(HEADER);
  header.set(new TextEncoder().encode(MAGIC));
  new DataView(header.buffer).setUint32(MAGIC.length, manifest.length, true);
  return new Blob([header, manifest, ...blobs], { type: PROJECT_MIME });
}

export function isProjectFile(file: { name: string }): boolean {
  return file.name.toLowerCase().endsWith(PROJECT_EXT);
}

/**
 * Reads a project file. Returns the saved document (still to be checked with
 * restoreDoc) and the photo files by id. Throws ProjectError for anything
 * that is not a readable project.
 */
export async function readProject(file: Blob): Promise<{ saved: unknown; images: Map<string, Blob> }> {
  if (file.size < HEADER) throw new ProjectError('To nie jest plik projektu Mosaic');
  const head = new Uint8Array(await file.slice(0, HEADER).arrayBuffer());
  if (new TextDecoder().decode(head.subarray(0, MAGIC.length)) !== MAGIC) throw new ProjectError('To nie jest plik projektu Mosaic');
  const length = new DataView(head.buffer).getUint32(MAGIC.length, true);
  if (length > MAX_MANIFEST || HEADER + length > file.size) throw new ProjectError('Plik projektu jest uszkodzony');

  let manifest: unknown;
  try {
    manifest = JSON.parse(await file.slice(HEADER, HEADER + length).text());
  } catch {
    throw new ProjectError('Plik projektu jest uszkodzony');
  }
  if (typeof manifest !== 'object' || manifest === null) throw new ProjectError('Plik projektu jest uszkodzony');
  const { saved, images: list } = manifest as { saved?: unknown; images?: unknown };
  if (!Array.isArray(list)) throw new ProjectError('Plik projektu jest uszkodzony');

  const images = new Map<string, Blob>();
  let offset = HEADER + length;
  for (const item of list as Partial<ImageInfo>[]) {
    const { id, type, size } = item ?? {};
    if (typeof id !== 'string' || !id || typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0 || offset + size > file.size) {
      throw new ProjectError('Plik projektu jest uszkodzony');
    }
    images.set(id, file.slice(offset, offset + size, typeof type === 'string' ? type : ''));
    offset += size;
  }
  return { saved, images };
}

export function projectFileName(doc: Pick<Doc, 'sheet'>): string {
  return `kolaz_${doc.sheet.widthMm}x${doc.sheet.heightMm}${PROJECT_EXT}`;
}
