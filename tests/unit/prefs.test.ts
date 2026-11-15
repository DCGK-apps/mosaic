import { beforeEach, describe, expect, it } from 'vitest';
import { collagesWord, photosWord } from '../../src/plural';
import { PREFS_KEY, loadPref, savePref } from '../../src/prefs';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('prefs', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  });

  it('returns the fallback until a value is saved', () => {
    expect(loadPref('installDismissed', false)).toBe(false);
    savePref('installDismissed', true);
    expect(loadPref('installDismissed', false)).toBe(true);
  });

  it('keeps other preferences when saving one', () => {
    savePref('a', 1);
    savePref('b', 2);
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ a: 1, b: 2 });
  });

  it('falls back when storage holds garbage', () => {
    localStorage.setItem(PREFS_KEY, '{not json');
    expect(loadPref('a', 'x')).toBe('x');
  });
});

describe('plural', () => {
  it('declines Polish nouns', () => {
    expect([1, 2, 5, 12, 22, 25, 104].map(photosWord)).toEqual(['zdjęcie', 'zdjęcia', 'zdjęć', 'zdjęć', 'zdjęcia', 'zdjęć', 'zdjęcia']);
    expect([1, 3, 11, 0].map(collagesWord)).toEqual(['kolaż', 'kolaże', 'kolaży', 'kolaży']);
  });
});
