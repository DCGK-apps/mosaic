import { useEffect, useState } from 'react';
import { canvasMeasure } from './core/export';
import { fontCss, FONTS, REF_PX, type Measure, type TextBox } from './core/text';

/** Same split as Fontsource: Polish letters are in latin-ext, loaded only when the text has them. */
const SUBSETS = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext':
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
};

let registered = false;

/**
 * Registers the caption fonts (files in public/fonts, cached by the service
 * worker for offline use). Nothing is downloaded until a font is used.
 */
export function registerFonts(): void {
  if (registered || typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') return;
  registered = true;
  for (const f of FONTS) {
    for (const weight of f.weights) {
      for (const style of f.italic ? ['normal', 'italic'] : ['normal']) {
        for (const [subset, unicodeRange] of Object.entries(SUBSETS)) {
          const url = `./fonts/${f.file}-${subset}-${weight}-${style}.woff2`;
          document.fonts.add(new FontFace(f.family, `url(${url}) format("woff2")`, { weight: String(weight), style, unicodeRange, display: 'swap' }));
        }
      }
    }
  }
}

/** Loads the fonts the captions use (with their letters); resolves even when a file fails. */
export async function loadFonts(texts: readonly Pick<TextBox, 'font' | 'bold' | 'italic' | 'text'>[]): Promise<void> {
  registerFonts();
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(texts.map((t) => document.fonts.load(fontCss(t, REF_PX), t.text || 'A').catch(() => undefined)));
}

function makeMeasure(): Measure {
  const ctx = document.createElement('canvas').getContext('2d');
  return ctx ? canvasMeasure(ctx) : (text) => ({ width: text.length * REF_PX * 0.55, ascent: REF_PX * 0.9, descent: REF_PX * 0.25 });
}

/**
 * Text measuring for the preview (the same canvas measuring as the export).
 * A new function whenever a font finishes loading, so the captions are measured again.
 */
export function useTextMeasure(): Measure {
  const [measure, setMeasure] = useState<Measure>(makeMeasure);
  useEffect(() => {
    registerFonts();
    if (!document.fonts) return;
    const renew = () => setMeasure(() => makeMeasure());
    document.fonts.addEventListener('loadingdone', renew);
    return () => document.fonts.removeEventListener('loadingdone', renew);
  }, []);
  return measure;
}
