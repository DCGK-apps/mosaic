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
/** Largest number of photos in one collage the user can ask for (and the most the app suggests). */
export const MAX_PER_COLLAGE = 20;
/** "Zrób N kolaży": the user may go past MAX_PER_COLLAGE after a warning, but never past this. */
export const HARD_MAX_PER_COLLAGE = 40;

export interface BatchOptions {
  /** Photos per collage, from `min` to `max`. */
  min: number;
  max: number;
  /** "Zrób N kolaży": exactly this many collages (or one per photo when there are fewer); `min`/`max` are then ignored. */
  count?: number;
  mode: LayoutMode;
  sheet: Sheet;
}

export type BatchOrder = 'date' | 'name' | 'random';

/** What is known about a photo file before it is read. */
export interface FileInfo {
  /** Path inside the chosen folder, e.g. "Wakacje/2024/IMG_0012.jpg". */
  path: string;
  /** When the photo was taken (EXIF), ms since 1970. */
  taken?: number;
  /** File modification time, ms since 1970. */
  modified: number;
}

/**
 * True for a file directly in the chosen folder ("Wakacje/IMG_1.jpg"), false for
 * one in a folder inside it ("Wakacje/2024/IMG_1.jpg"). The path starts with the
 * chosen folder's name, as the browser gives it.
 */
export function inChosenFolder(path: string): boolean {
  return path.split('/').length <= 2;
}

const natural = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });

/**
 * The order of photos in the series. By date: when the photo was taken (or,
 * without EXIF, when the file was last changed), then by name. By name: the way
 * file managers list them – "IMG_2" before "IMG_10". Random: shuffled, the same
 * way for the same seed (whatever order the browser lists the files in).
 */
export function sortFiles<T extends FileInfo>(files: readonly T[], order: BatchOrder, seed = 0): T[] {
  const byName = (a: T, b: T) => natural.compare(a.path, b.path);
  if (order === 'name') return files.toSorted(byName);
  if (order === 'random') {
    const out = files.toSorted(byName);
    const rng = createRng(seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
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

/** Keeps the number of collages sensible: 1 … MAX_BATCH_PHOTOS. */
export function clampCount(count: number): number {
  return Math.min(MAX_BATCH_PHOTOS, Math.max(1, Math.round(Number.isFinite(count) ? count : 1)));
}

/** How `n` photos split into `count` collages as evenly as possible. */
export interface CountCheck {
  /** ok – fine; fewPhotos – fewer photos than collages; large – more than MAX_PER_COLLAGE photos
   * in a collage (allowed after a warning); tooLarge – more than HARD_MAX_PER_COLLAGE (not allowed). */
  kind: 'ok' | 'fewPhotos' | 'large' | 'tooLarge';
  /** Photos in the smallest and the largest collage. */
  small: number;
  big: number;
  /** The count the app suggests instead (same as `count` when it is fine). */
  suggest: number;
}

export function checkCount(n: number, count: number): CountCheck {
  const c = clampCount(count);
  if (n <= 0) return { kind: 'ok', small: 0, big: 0, suggest: c };
  if (n < c) return { kind: 'fewPhotos', small: 1, big: 1, suggest: n };
  const small = Math.floor(n / c);
  const big = Math.ceil(n / c);
  const suggest = Math.min(n, Math.ceil(n / MAX_PER_COLLAGE));
  const kind = big > HARD_MAX_PER_COLLAGE ? 'tooLarge' : big > MAX_PER_COLLAGE ? 'large' : 'ok';
  return { kind, small, big, suggest: kind === 'ok' ? c : suggest };
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
  if (opts.count !== undefined) return planCount(photos, opts, seed, tick);
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

/**
 * "Zrób N kolaży": exactly N collages (fewer only when there are fewer photos),
 * sizes differing by at most one. Which collages get the extra photo is chosen
 * the way planBatch chooses sizes – where the photos fit the layout best.
 */
async function planCount(
  photos: readonly Photo[],
  opts: BatchOptions,
  seed: number,
  tick?: (done: number, total: number) => void | Promise<void>,
): Promise<number[]> {
  const n = photos.length;
  const count = Math.min(n, clampCount(opts.count ?? 1));
  const small = Math.floor(n / count);
  const extra = n - small * count;
  if (extra === 0) {
    await tick?.(n, n);
    return Array.from({ length: count }, () => small);
  }

  const costs = new Map<number, number>();
  const cost = (start: number, k: number): number => {
    const key = start * 2 + (k - small);
    let c = costs.get(key);
    if (c === undefined) {
      const group = photos.slice(start, start + k) as Photo[];
      const rng = createRng(mix(seed, start, k));
      const tree = opts.mode === 'auto' ? autoLayout(group, opts.sheet, rng, planAttempts(k)) : fixedLayout(opts.mode, group, rng);
      c = layoutCost(tree, group, opts.sheet) * k;
      costs.set(key, c);
    }
    return c;
  };

  // best[j][b] – the cheapest first j collages with b of them bigger; they start at photo j·small + b.
  const width = extra + 1;
  const best = new Float64Array((count + 1) * width).fill(Infinity);
  const bigger = new Uint8Array((count + 1) * width);
  best[0] = 0;
  for (let j = 0; j < count; j++) {
    await tick?.(j * small, n);
    for (let b = 0; b <= Math.min(j, extra); b++) {
      const here = best[j * width + b]!;
      if (here === Infinity) continue;
      const start = j * small + b;
      // The rest must still be able to take the remaining bigger collages.
      if (extra - b <= count - j - 1) {
        const total = here + cost(start, small);
        const at = (j + 1) * width + b;
        if (total < best[at]!) {
          best[at] = total;
          bigger[at] = 0;
        }
      }
      if (b < extra) {
        const total = here + cost(start, small + 1);
        const at = (j + 1) * width + b + 1;
        if (total < best[at]!) {
          best[at] = total;
          bigger[at] = 1;
        }
      }
    }
  }
  await tick?.(n, n);

  const sizes: number[] = [];
  for (let j = count, b = extra; j > 0; j--) {
    const up = bigger[j * width + b]!;
    sizes.push(small + up);
    b -= up;
  }
  return sizes.toReversed();
}

/** The collages of the series: consecutive groups of `sizes` photos, each laid out and tagged with its key. */
export function buildBatch(photos: readonly Photo[], sizes: readonly number[], opts: Omit<BatchOptions, 'min' | 'max' | 'count'>, seed: number): Doc[] {
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
