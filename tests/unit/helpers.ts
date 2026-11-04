import { DEFAULT_CROP } from '../../src/core/crop';
import type { Leaf, Node, Photo, Split } from '../../src/core/types';

export function photo(id: string, width = 400, height = 300): Photo {
  return { id, name: `${id}.jpg`, width, height, crop: { ...DEFAULT_CROP } };
}

export const leaf = (id: string, photoId = id): Leaf => ({ kind: 'leaf', id, photoId });
export const split = (id: string, dir: 'V' | 'H', frac: number, a: Node, b: Node): Split => ({ kind: 'split', id, dir, frac, a, b });

/** Ids from a counter – readable in failures. */
export function counter(prefix = 'n'): () => string {
  let i = 0;
  return () => `${prefix}${i++}`;
}
