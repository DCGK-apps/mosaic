import type { Leaf, Node, Split } from './types';

export function leaves(node: Node | null): Leaf[] {
  if (!node) return [];
  return node.kind === 'leaf' ? [node] : [...leaves(node.a), ...leaves(node.b)];
}

export function splits(node: Node | null): Split[] {
  if (!node || node.kind === 'leaf') return [];
  return [node, ...splits(node.a), ...splits(node.b)];
}

/** Returns a copy with `fn` applied to every node, bottom-up. Unchanged subtrees are reused. */
function mapTree(node: Node, fn: (n: Node) => Node): Node {
  if (node.kind === 'leaf') return fn(node);
  const a = mapTree(node.a, fn);
  const b = mapTree(node.b, fn);
  return fn(a === node.a && b === node.b ? node : { ...node, a, b });
}

export const MIN_FRAC = 0.1;
export const MAX_FRAC = 0.9;

export function clampFrac(frac: number): number {
  return Math.min(MAX_FRAC, Math.max(MIN_FRAC, frac));
}

export function setFrac(tree: Node, splitId: string, frac: number): Node {
  const f = clampFrac(frac);
  return mapTree(tree, (n) => (n.kind === 'split' && n.id === splitId && n.frac !== f ? { ...n, frac: f } : n));
}

/** Swaps the photos shown in two cells. */
export function swapLeaves(tree: Node, leafA: string, leafB: string): Node {
  const all = leaves(tree);
  const a = all.find((l) => l.id === leafA);
  const b = all.find((l) => l.id === leafB);
  if (!a || !b || a === b) return tree;
  return mapTree(tree, (n) => {
    if (n.kind !== 'leaf') return n;
    if (n.id === a.id) return { ...n, photoId: b.photoId };
    if (n.id === b.id) return { ...n, photoId: a.photoId };
    return n;
  });
}

/** Removes the cell showing `photoId`; its sibling takes over the parent's space. */
export function removePhoto(node: Node, photoId: string): Node | null {
  if (node.kind === 'leaf') return node.photoId === photoId ? null : node;
  const a = removePhoto(node.a, photoId);
  const b = removePhoto(node.b, photoId);
  if (!a) return b;
  if (!b) return a;
  return a === node.a && b === node.b ? node : { ...node, a, b };
}
