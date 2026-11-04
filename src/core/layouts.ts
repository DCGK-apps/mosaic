import { idGen, type Rng } from './random';
import type { Dir, Leaf, LayoutMode, Node, Photo, Sheet, Split } from './types';

type NewId = () => string;
type Size = Pick<Sheet, 'widthMm' | 'heightMm'>;

const leaf = (id: NewId, photoId: string): Leaf => ({ kind: 'leaf', id: id(), photoId });

/** Equal parts in a row (V) or column (H). */
export function chain(id: NewId, photoIds: string[], dir: Dir): Node | null {
  if (photoIds.length === 0) return null;
  if (photoIds.length === 1) return leaf(id, photoIds[0]!);
  return {
    kind: 'split',
    id: id(),
    dir,
    frac: 1 / photoIds.length,
    a: leaf(id, photoIds[0]!),
    b: chain(id, photoIds.slice(1), dir)!,
  };
}

/** Rows ("Poziomo"): photos stacked one above the other. */
export function rowsLayout(photos: Photo[], id: NewId): Node | null {
  return chain(id, photos.map((p) => p.id), 'H');
}

/** Columns ("Pionowo"): photos side by side. */
export function colsLayout(photos: Photo[], id: NewId): Node | null {
  return chain(id, photos.map((p) => p.id), 'V');
}

/**
 * Even grid ("Siatka"): ⌈√n⌉ columns. Every photo appears once; when the last
 * row is not full, its photos are wider instead of repeating photos.
 */
export function gridLayout(photos: Photo[], id: NewId): Node | null {
  if (photos.length === 0) return null;
  const cols = Math.ceil(Math.sqrt(photos.length));
  const rows: Node[] = [];
  for (let i = 0; i < photos.length; i += cols) {
    rows.push(chain(id, photos.slice(i, i + cols).map((p) => p.id), 'V')!);
  }
  const stack = (rest: Node[]): Node =>
    rest.length === 1 ? rest[0]! : { kind: 'split', id: id(), dir: 'H', frac: 1 / rest.length, a: rest[0]!, b: stack(rest.slice(1)) };
  return stack(rows);
}

/**
 * Central layout ("Centralny"): the first photo in the middle, the others
 * around it – top, bottom, left and right. Side strips take ¼ of the sheet
 * (⅓ when only one side is used).
 */
export function centralLayout(photos: Photo[], id: NewId): Node | null {
  if (photos.length === 0) return null;
  const [center, ...others] = photos.map((p) => p.id);
  const m = others.length;
  let top = 0;
  let bottom = 0;
  let left = 0;
  if (m === 1) left = 1;
  else if (m === 2) left = 1;
  else if (m === 3) [top, left] = [1, 1];
  else if (m > 3) {
    top = Math.ceil(m / 4);
    bottom = Math.floor(m / 4);
    left = Math.ceil((m - top - bottom) / 2);
  }
  const topIds = others.slice(0, top);
  const bottomIds = others.slice(top, top + bottom);
  const leftIds = others.slice(top + bottom, top + bottom + left);
  const rightIds = others.slice(top + bottom + left); // the rest

  /** `before` | main | `after` along `dir`, the side strips ¼ each (⅓ when alone). */
  const around = (main: Node, before: string[], after: string[], dir: Dir, stripDir: Dir): Node => {
    const b = chain(id, before, stripDir);
    const a = chain(id, after, stripDir);
    const split = (frac: number, x: Node, y: Node): Split => ({ kind: 'split', id: id(), dir, frac, a: x, b: y });
    if (b && a) return split(1 / 4, b, split(2 / 3, main, a));
    if (b) return split(1 / 3, b, main);
    if (a) return split(2 / 3, main, a);
    return main;
  };

  const middle = around(leaf(id, center!), leftIds, rightIds, 'V', 'H');
  return around(middle, topIds, bottomIds, 'H', 'V');
}

const aspect = (p: Pick<Photo, 'width' | 'height'>) => (p.width > 0 && p.height > 0 ? p.width / p.height : 1);

interface Sized {
  node: Leaf;
  w: number;
  h: number;
}

/**
 * Automatic layout ("Auto"): many random divisions of the sheet; the one whose
 * cells best match the photos' proportions and have similar areas wins.
 */
export function autoLayout(photos: Photo[], size: Size, rng: Rng, attempts = 2500): Node | null {
  if (photos.length === 0) return null;
  const id = idGen(rng);
  const sorted = photos.toSorted((a, b) => aspect(b) - aspect(a));
  const count = photos.length;
  const area = size.widthMm * size.heightMm;
  let best: Node | null = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Grow a random tree by splitting random leaves.
    const root: { node: Node } = { node: { kind: 'leaf', id: id(), photoId: '' } };
    const open: { get: () => Node; set: (n: Node) => void }[] = [{ get: () => root.node, set: (n) => (root.node = n) }];
    for (let i = 1; i < count; i++) {
      const pick = Math.floor(rng() * open.length);
      const slot = open[pick]!;
      const split: Split = {
        kind: 'split',
        id: id(),
        dir: rng() > 0.5 ? 'V' : 'H',
        frac: 0.35 + rng() * 0.3,
        a: { kind: 'leaf', id: id(), photoId: '' },
        b: { kind: 'leaf', id: id(), photoId: '' },
      };
      slot.set(split);
      open.splice(pick, 1, { get: () => split.a, set: (n) => (split.a = n) }, { get: () => split.b, set: (n) => (split.b = n) });
    }

    const cells: Sized[] = [];
    const measure = (n: Node, w: number, h: number): void => {
      if (n.kind === 'leaf') cells.push({ node: n, w, h });
      else if (n.dir === 'V') {
        measure(n.a, w * n.frac, h);
        measure(n.b, w * (1 - n.frac), h);
      } else {
        measure(n.a, w, h * n.frac);
        measure(n.b, w, h * (1 - n.frac));
      }
    };
    measure(root.node, size.widthMm, size.heightMm);
    cells.sort((a, b) => b.w / b.h - a.w / a.h);

    // Widest cell gets the widest photo, and so on.
    let maxDistortion = 0;
    let sumDistortion = 0;
    cells.forEach((c, i) => {
      const photo = sorted[i]!;
      const cellAr = c.w / c.h;
      const distortion = Math.max(cellAr / aspect(photo), aspect(photo) / cellAr) - 1;
      maxDistortion = Math.max(maxDistortion, distortion);
      sumDistortion += distortion;
      c.node.photoId = photo.id;
    });
    const mean = area / count;
    const variance = cells.reduce((s, c) => s + (c.w * c.h - mean) ** 2, 0) / count;
    const areaCv = Math.sqrt(variance) / mean;

    let score = -areaCv * 3000 - sumDistortion * 500;
    if (maxDistortion > 0.25) score -= (maxDistortion - 0.25) * 10000;
    if (score > bestScore) {
      bestScore = score;
      best = structuredClone(root.node);
    }
  }
  return best;
}

/** Layout for one of the fixed modes. */
export function fixedLayout(mode: Exclude<LayoutMode, 'auto'>, photos: Photo[], rng: Rng): Node | null {
  const id = idGen(rng);
  switch (mode) {
    case 'grid':
      return gridLayout(photos, id);
    case 'central':
      return centralLayout(photos, id);
    case 'rows':
      return rowsLayout(photos, id);
    case 'cols':
      return colsLayout(photos, id);
  }
}
