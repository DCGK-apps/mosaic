import { describe, expect, it } from 'vitest';
import { clampFrac, leaves, removePhoto, setFrac, splits, swapLeaves } from '../../src/core/tree';
import { leaf, split } from './helpers';

const tree = split('s1', 'V', 0.5, leaf('a'), split('s2', 'H', 0.3, leaf('b'), leaf('c')));

describe('tree', () => {
  it('lists leaves left to right and splits top-down', () => {
    expect(leaves(tree).map((l) => l.photoId)).toEqual(['a', 'b', 'c']);
    expect(splits(tree).map((s) => s.id)).toEqual(['s1', 's2']);
    expect(leaves(null)).toEqual([]);
  });

  it('sets a divider position within 10–90%', () => {
    expect(splits(setFrac(tree, 's2', 0.6))[1]!.frac).toBe(0.6);
    expect(splits(setFrac(tree, 's2', 0.01))[1]!.frac).toBe(0.1);
    expect(clampFrac(2)).toBe(0.9);
  });

  it('reuses untouched subtrees and returns the same tree when nothing changes', () => {
    const next = setFrac(tree, 's2', 0.6);
    expect((next as typeof tree).a).toBe(tree.a);
    expect(setFrac(tree, 's2', 0.3)).toBe(tree);
    expect(setFrac(tree, 'missing', 0.4)).toBe(tree);
  });

  it('swaps the photos of two cells, keeping the cells', () => {
    const next = swapLeaves(tree, 'a', 'c');
    expect(leaves(next).map((l) => [l.id, l.photoId])).toEqual([
      ['a', 'c'],
      ['b', 'b'],
      ['c', 'a'],
    ]);
    expect(swapLeaves(tree, 'a', 'a')).toBe(tree);
    expect(swapLeaves(tree, 'a', 'zzz')).toBe(tree);
  });

  it('removing a photo lets its neighbour take the space', () => {
    const next = removePhoto(tree, 'b')!;
    expect(next).toEqual(split('s1', 'V', 0.5, leaf('a'), leaf('c')));
    expect(removePhoto(leaf('a'), 'a')).toBeNull();
    expect(removePhoto(tree, 'nope')).toBe(tree);
  });
});
