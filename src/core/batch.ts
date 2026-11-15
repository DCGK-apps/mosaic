/**
 * Automatic series of collages ("Kolaże z folderu"): photos from a folder are
 * split, in their order, into consecutive collages of a chosen size range.
 */
import { docReducer, emptyDoc } from './doc';
import { autoLayout, fixedLayout, layoutCost } from './layouts';
import { createRng, idGen } from './random';
import type { Doc, LayoutMode, Photo, Sheet } from './types';

/** Most photos taken from one folder: every photo is kept in memory and in the autosave. */
export const MAX_BATCH_PHOTOS = 500;
/** Largest number of photos in one collage the user can ask for. */
export const MAX_PER_COLLAGE = 20;

export interface BatchOptions {
  /** Photos per collage, from `min` to `max`. */
  min: number;
  max: number;
  mode: LayoutMode;
  sheet: Sheet;
}

export type BatchOrder = 'date' | 'name';

/** What is known about a photo file before it is read. */
export interface FileInfo {
  /** Path inside the chosen folder, e.g. "Wakacje/2024/IMG_0012.jpg". */
  path: string;
  /** When the photo was taken (EXIF), ms since 1970. */
  taken?: number;
  /** File modification time, ms since 1970. */
  modified: number;
}

const natural = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });

/**
 * The order of photos in the series. By date: when the photo was taken (or,
 * without EXIF, when the file was last changed), then by name. By name: the way
 * file managers list them – "IMG_2" before "IMG_10".
 */
export function sortFiles<T extends FileInfo>(files: readonly T[], order: BatchOrder): T[] {
  const byName = (a: T, b: T) => natural.compare(a.path, b.path);
  if (order === 'name') return files.toSorted(byName);
  return files.toSorted((a, b) => (a.taken ?? a.modified) - (b.taken ?? b.modified) || byName(a, b));
}

/** How many collages `n` photos can make with min…max photos each (null when no count fits exactly). */
export function collageCount(n: number, min: number, max: number): { lo: number; hi: number } | null {
  if (n <= 0) return { lo: 0, hi: 0 };
  const lo = Math.ceil(n / max);
  const hi = Math.floor(n / min);
  return lo <= hi ? { lo, hi } : null;
}

/** Keeps the range sensible: 1 ≤ min ≤ max ≤ MAX_PER_COLLAGE. */
export function clampRange(min: number, max: number): { min: number; max: number } {
  const c = (v: number) => Math.min(MAX_PER_COLLAGE, Math.max(1, Math.round(Number.isFinite(v) ? v : 1)));
  const lo = c(min);
  return { min: lo, max: Math.max(lo, c(max)) };
}

/**
 * Random tries per candidate collage while planning (the final layout uses the
 * full count). Fewer for big collages – each try costs more and the score settles anyway.
 */
const planAttempts = (k: number) => Math.min(120, Math.max(40, Math.round(600 / k)));
/** Cost of each photo too many or too few in a collage – only when the range cannot be met exactly. */
const OUT_OF_RANGE = 1e6;
/** Mild preference for collages of similar size. */
const UNEVEN = 150;

const mix = (seed: number, a: number, b: number) => (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77)) >>> 0;

/**
 * How many photos go into each collage, in order. Each collage gets min…max
 * photos (when that is possible at all), and among such splits the one whose
 * collages look best wins: cells close to the photos' proportions and of
 * similar size (e.g. 4 or 6 photos rather than 5 for an even grid).
 *
 * `tick` is called as the work goes on; it may return a promise (the UI waits
 * a frame there so it stays responsive) and may throw to cancel.
 */
export async function planBatch(
  photos: readonly Photo[],
  opts: BatchOptions,
  seed: number,
  tick?: (done: number, total: number) => void | Promise<void>,
): Promise<number[]> {
  const n = photos.length;
  if (n === 0) return [];
  const { min, max } = clampRange(opts.min, opts.max);
  const fits = collageCount(n, min, max);
  // When no split fits the range exactly, the closest ones are allowed (e.g. 3 photos with "4 to 6").
  const kLo = fits ? min : 1;
  const kHi = Math.min(n, fits ? max : max + min);
  const count = fits ? Math.min(fits.hi, Math.max(fits.lo, Math.round(n / ((min + max) / 2)))) : Math.max(1, Math.round(n / max));
  const ideal = n / count;

  const cost = (start: number, k: number): number => {
    const group = photos.slice(start, start + k) as Photo[];
    const rng = createRng(mix(seed, start, k));
    const tree = opts.mode === 'auto' ? autoLayout(group, opts.sheet, rng, planAttempts(k)) : fixedLayout(opts.mode, group, rng);
    const outside = k < min ? min - k : k > max ? k - max : 0;
    return layoutCost(tree, group, opts.sheet) * k + UNEVEN * (k - ideal) ** 2 + OUT_OF_RANGE * outside ** 2;
  };

  // best[i] – the cheapest split of the first i photos; from[i] – size of its last collage.
  const best = new Float64Array(n + 1).fill(Infinity);
  const from = new Int32Array(n + 1);
  best[0] = 0;
  for (let start = 0; start < n; start++) {
    await tick?.(start, n);
    if (best[start] === Infinity) continue;
    for (let k = kLo; k <= kHi && start + k <= n; k++) {
      const total = best[start]! + cost(start, k);
      if (total < best[start + k]!) {
        best[start + k] = total;
        from[start + k] = k;
      }
    }
  }
  await tick?.(n, n);

  const sizes: number[] = [];
  for (let i = n; i > 0; i -= from[i]!) sizes.push(from[i]!);
  return sizes.toReversed();
}

/** The collages of the series: consecutive groups of `sizes` photos, each laid out and tagged with its key. */
export function buildBatch(photos: readonly Photo[], sizes: readonly number[], opts: Omit<BatchOptions, 'min' | 'max'>, seed: number): Doc[] {
  const rng = createRng(seed);
  const key = idGen(rng);
  const docs: Doc[] = [];
  let start = 0;
  for (const size of sizes) {
    const group = photos.slice(start, start + size);
    start += size;
    const base: Doc = { ...emptyDoc(), sheet: { ...opts.sheet }, mode: opts.mode, batchKey: `b${key()}` };
    docs.push(docReducer(base, { type: 'addPhotos', photos: group, seed: Math.floor(rng() * 2 ** 32) }));
  }
  return docs;
}

/**
 * Name of the n-th file of the series (counting from 1): "wakacje" → "wakacje_001".
 * More than 999 collages simply get more digits.
 */
export function seriesFileBase(base: string, n: number): string {
  return `${base}_${String(n).padStart(3, '0')}`;
}

/** The series' copy of the collage being edited: the photo store (magazine) belongs to the editor, not to one collage. */
export function batchCopy(doc: Doc): Doc {
  return doc.magazine.length ? { ...doc, magazine: [] } : doc;
}

/** Puts the edited collage back into the series; the same array when nothing changed. */
export function writeBack(batch: Doc[], doc: Doc): Doc[] {
  if (!doc.batchKey) return batch;
  const i = batch.findIndex((d) => d.batchKey === doc.batchKey);
  if (i < 0) return batch;
  const copy = batchCopy(doc);
  const old = batch[i]!;
  const same = (Object.keys(copy) as (keyof Doc)[]).every((k) => k === 'magazine' || old[k] === copy[k]);
  if (same && old.magazine.length === 0) return batch;
  const next = [...batch];
  next[i] = copy;
  return next;
}

/** Photo ids used anywhere in the series. */
export function batchPhotoIds(batch: readonly Doc[]): Set<string> {
  return new Set(batch.flatMap((d) => d.photos.map((p) => p.id)));
}
