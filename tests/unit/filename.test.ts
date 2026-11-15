import { describe, expect, it } from 'vitest';
import { cleanName, rememberName, suggestName, type NameMemory } from '../../src/core/filename';

/** Saves the suggested name `times` times, as a user pressing Enter would. */
function saveSuggested(start: string, times: number): string[] {
  let memory: NameMemory | null = rememberName(start, null);
  const names: string[] = [];
  for (let i = 0; i < times; i++) {
    const name = suggestName(memory, 'x');
    names.push(name);
    memory = rememberName(name, memory);
  }
  return names;
}

describe('file names', () => {
  it('suggests the default name first', () => {
    expect(suggestName(null, 'kolaz_504x506mm')).toBe('kolaz_504x506mm');
  });

  it('adds a two-digit number to the last name and keeps counting', () => {
    expect(saveSuggested('wakacje', 3)).toEqual(['wakacje01', 'wakacje02', 'wakacje03']);
    expect(saveSuggested('kolaz_504x506mm', 1)).toEqual(['kolaz_504x506mm01']);
  });

  it('continues a two-digit number typed by the user', () => {
    expect(saveSuggested('wakacje05', 1)).toEqual(['wakacje06']);
    expect(saveSuggested('09', 1)).toEqual(['10']);
  });

  it('goes past 99 without starting over', () => {
    expect(saveSuggested('wakacje98', 3)).toEqual(['wakacje99', 'wakacje100', 'wakacje101']);
  });

  it('treats other numbers as part of the name', () => {
    expect(saveSuggested('wakacje2026', 2)).toEqual(['wakacje202601', 'wakacje202602']);
    expect(saveSuggested('foto5', 1)).toEqual(['foto501']);
  });

  it('cleans what the user typed', () => {
    expect(cleanName('  wakacje.jpg ', '.jpg')).toBe('wakacje');
    expect(cleanName('wakacje.JPEG', '.jpg')).toBe('wakacje');
    expect(cleanName('lato.mosaic', '.mosaic')).toBe('lato');
    expect(cleanName('a/b:c?', '.png')).toBe('a_b_c_');
    expect(cleanName(' ... ', '.png')).toBe('');
  });
});
