import { describe, expect, it } from 'vitest';
import { docReducer, emptyDoc } from '../../src/core/doc';
import { drawMosaic, type DrawContext } from '../../src/core/export';
import { cleanText, fontCss, layoutText, moveText, newTextBox, normalizeAngle, REF_PX, snapAngle, type Measure } from '../../src/core/text';
import { restoreDoc, toSaved } from '../../src/storage/serialize';

/** Every letter is half the font size wide; ascent 0.8, descent 0.2. */
const measure: Measure = (text) => ({ width: text.length * REF_PX * 0.5, ascent: REF_PX * 0.8, descent: REF_PX * 0.2 });
const sheet = { widthMm: 200, heightMm: 100 };

describe('captions', () => {
  it('starts in the middle with a readable size and follows the style of the previous caption', () => {
    const a = newTextBox('a', sheet);
    expect(a).toMatchObject({ x: 0.5, y: 0.5, rotation: 0 });
    expect(a.sizeMm).toBeGreaterThan(5);
    const b = newTextBox('b', sheet, { ...a, font: 'lora', color: '#123456', italic: true, rotation: 30 });
    expect(b).toMatchObject({ font: 'lora', color: '#123456', italic: true, rotation: 0 });
    expect(b.y).not.toBe(a.y);
  });

  it('lays out lines around the centre with the chosen alignment', () => {
    const t = { ...newTextBox('t', sheet), text: 'Zażółć\nab', sizeMm: 10, align: 'right' as const, x: 0.25, y: 0.5 };
    const l = layoutText(t, sheet, measure);
    expect(l.w).toBe(30);
    expect(l.h).toBe(25);
    expect(l).toMatchObject({ cx: 50, cy: 50 });
    expect(l.lines.map((x) => x.x)).toEqual([0, 20]);
    // Line box 12.5 mm, font 8 + 2 mm: baseline 1.25 mm below the top plus the ascent.
    expect(l.lines[0]!.baseline).toBeCloseTo(9.25);
    expect(l.lines[1]!.baseline).toBeCloseTo(21.75);
    expect(layoutText({ ...t, align: 'center' }, sheet, measure).lines[1]!.x).toBe(10);
  });

  it('builds the CSS font with the style', () => {
    expect(fontCss({ font: 'playfair', bold: true, italic: true }, 20)).toBe('italic 700 20px "Mosaic Playfair", serif');
    expect(fontCss({ font: 'roboto', bold: false, italic: false }, 12)).toBe('400 12px "Mosaic Roboto", sans-serif');
  });

  it('keeps values within limits', () => {
    const t = cleanText({ ...newTextBox('t', sheet), x: 3, y: -1, sizeMm: 0, rotation: 370, color: 'red', font: 'nope' as never });
    expect(t).toMatchObject({ x: 1, y: 0, sizeMm: 2, rotation: 10, color: '#ffffff', font: 'roboto' });
    expect(normalizeAngle(-190)).toBe(170);
    expect(snapAngle(88)).toBe(90);
    expect(snapAngle(80)).toBe(80);
    expect(moveText({ ...t, x: 0.5, y: 0.5 }, 20, -10, sheet)).toEqual({ x: 0.6, y: 0.4 });
  });

  it('adds, edits and deletes captions in the document', () => {
    const box = newTextBox('t1', sheet);
    let doc = docReducer(emptyDoc(), { type: 'addText', box });
    expect(doc.texts).toHaveLength(1);
    const same = docReducer(doc, { type: 'updateText', id: 't1', patch: { text: box.text } });
    expect(same).toBe(doc);
    doc = docReducer(doc, { type: 'updateText', id: 't1', patch: { text: 'Łódź', bold: false } });
    expect(doc.texts![0]).toMatchObject({ id: 't1', text: 'Łódź', bold: false });
    expect(docReducer(doc, { type: 'updateText', id: 'x', patch: { text: 'a' } })).toBe(doc);
    doc = docReducer(doc, { type: 'deleteText', id: 't1' });
    expect(doc.texts).toEqual([]);
  });

  it('survives saving and restoring; broken captions are dropped', () => {
    const box = { ...newTextBox('t1', sheet), text: 'Gęś', font: 'caveat' as const, underline: true };
    const doc = docReducer(emptyDoc(), { type: 'addText', box });
    const saved = JSON.parse(JSON.stringify(toSaved(doc)));
    saved.doc.texts.push({ id: 'bad' }, null);
    expect(restoreDoc(saved, () => true)!.texts).toEqual([box]);
    expect(restoreDoc(toSaved(emptyDoc()), () => true)!.texts).toBeUndefined();
  });

  it('draws captions above the photos, skipping empty ones', () => {
    const calls: unknown[][] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === 'measureText' ? (s: string) => ({ width: s.length * 50, fontBoundingBoxAscent: 80, fontBoundingBoxDescent: 20 }) : (...args: unknown[]) => calls.push([prop, ...args]),
        set: (_t, prop, value) => (calls.push([`set ${String(prop)}`, value]), true),
      },
    ) as unknown as DrawContext;
    const texts = [
      { ...newTextBox('a', sheet), text: 'Żółw', underline: true },
      { ...newTextBox('b', sheet), text: '  ' },
    ];
    drawMosaic(ctx, { tree: null, sheet: { ...sheet, gapMm: 0, radiusMm: 0, frameColor: '#fff' }, photos: [], texts }, new Map(), 2);
    const fills = calls.filter((c) => c[0] === 'fillText');
    expect(fills).toHaveLength(1);
    expect(fills[0]![1]).toBe('Żółw');
    // Background, then the underline.
    expect(calls.filter((c) => c[0] === 'fillRect')).toHaveLength(2);
  });
});
