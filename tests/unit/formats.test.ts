import { describe, expect, it } from 'vitest';
import { applyFormat, clampSide, FORMATS, matchFormat } from '../../src/core/formats';
import { createRng, idGen } from '../../src/core/random';

describe('formats', () => {
  const a4 = FORMATS.find((f) => f.id === 'a4')!;

  it('recognises a preset in both orientations', () => {
    expect(matchFormat(210, 297)).toBe(a4);
    expect(matchFormat(297, 210)).toBe(a4);
    expect(matchFormat(504, 506)).toBeUndefined();
  });

  it('applying a preset keeps the orientation', () => {
    expect(applyFormat(a4, { widthMm: 500, heightMm: 400 })).toEqual({ widthMm: 297, heightMm: 210 });
    expect(applyFormat(a4, { widthMm: 400, heightMm: 500 })).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it('keeps the side length sane', () => {
    expect(clampSide(0)).toBe(10);
    expect(clampSide(Number.NaN)).toBe(10);
    expect(clampSide(99999)).toBe(2000);
    expect(clampSide(210.4)).toBe(210);
  });
});

describe('random', () => {
  it('the same seed gives the same numbers and ids', () => {
    const a = createRng(5);
    const b = createRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(idGen(createRng(1))()).toBe(idGen(createRng(1))());
    const values = Array.from({ length: 1000 }, createRng(9));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});
