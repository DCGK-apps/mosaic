/**
 * Captions on the collage. A caption is plain data (TextBox); its lines are
 * laid out here in millimetres of the sheet, the same way for the on-screen
 * preview and for the exported file. Only the text measuring comes from the
 * browser (canvas measureText), passed in as `Measure`.
 */
import type { FontId, Sheet, TextBox } from './types';

export type { FontId, TextAlign, TextBox } from './types';


export interface FontInfo {
  id: FontId;
  /** Name shown in the font list. */
  label: string;
  /** Kind of the font, shown next to the name. */
  kind: string;
  /** CSS family the font files are registered under (see fonts.ts). */
  family: string;
  /** Generic family used until the font is loaded. */
  fallback: string;
  /** File name prefix in public/fonts. */
  file: string;
  /** Weights with their own files (others are synthesised by the browser). */
  weights: readonly (400 | 700)[];
  /** True when there are italic files. */
  italic: boolean;
}

export const FONTS: readonly FontInfo[] = [
  { id: 'roboto', label: 'Roboto', kind: 'prosta', family: 'Mosaic Roboto', fallback: 'sans-serif', file: 'roboto', weights: [400, 700], italic: true },
  { id: 'lora', label: 'Lora', kind: 'szeryfowa', family: 'Mosaic Lora', fallback: 'serif', file: 'lora', weights: [400, 700], italic: true },
  { id: 'playfair', label: 'Playfair Display', kind: 'elegancka', family: 'Mosaic Playfair', fallback: 'serif', file: 'playfair-display', weights: [400, 700], italic: true },
  { id: 'oswald', label: 'Oswald', kind: 'wąska', family: 'Mosaic Oswald', fallback: 'sans-serif', file: 'oswald', weights: [400, 700], italic: false },
  { id: 'caveat', label: 'Caveat', kind: 'odręczna', family: 'Mosaic Caveat', fallback: 'cursive', file: 'caveat', weights: [400, 700], italic: false },
  { id: 'pacifico', label: 'Pacifico', kind: 'ozdobna', family: 'Mosaic Pacifico', fallback: 'cursive', file: 'pacifico', weights: [400], italic: false },
  { id: 'comfortaa', label: 'Comfortaa', kind: 'zaokrąglona', family: 'Mosaic Comfortaa', fallback: 'sans-serif', file: 'comfortaa', weights: [400, 700], italic: false },
];

export const fontInfo = (id: FontId): FontInfo => FONTS.find((f) => f.id === id) ?? FONTS[0]!;


/** Line height as a multiple of the font size. */
export const LINE_HEIGHT = 1.25;
export const MIN_TEXT_MM = 2;
export const MAX_TEXT_MM = 300;
/** Text shown on the sheet when a new caption is added. */
export const NEW_TEXT = 'Twój napis';

export const clampTextSize = (mm: number) => Math.min(MAX_TEXT_MM, Math.max(MIN_TEXT_MM, Math.round((Number.isFinite(mm) ? mm : MIN_TEXT_MM) * 10) / 10));
const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));
/** Angle in -180..180, rounded to a tenth of a degree. */
export function normalizeAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const a = ((((deg + 180) % 360) + 360) % 360) - 180;
  return Math.round(a * 10) / 10 || 0;
}

/** Snaps an angle to the nearest multiple of 45° when it is within `tolerance`. */
export function snapAngle(deg: number, tolerance = 4): number {
  const nearest = Math.round(deg / 45) * 45;
  return Math.abs(deg - nearest) <= tolerance ? normalizeAngle(nearest) : normalizeAngle(deg);
}

/** Keeps every value of a caption within its limits. */
export function cleanText(t: TextBox): TextBox {
  return {
    ...t,
    x: clamp01(t.x),
    y: clamp01(t.y),
    sizeMm: clampTextSize(t.sizeMm),
    font: fontInfo(t.font).id,
    color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#ffffff',
    align: t.align === 'left' || t.align === 'right' ? t.align : 'center',
    rotation: normalizeAngle(t.rotation),
  };
}

/**
 * A new caption in the middle of the sheet. Its style follows `like` (the
 * caption edited last), so a series of captions looks the same.
 */
export function newTextBox(id: string, sheet: Pick<Sheet, 'widthMm' | 'heightMm'>, like?: TextBox): TextBox {
  const base: Omit<TextBox, 'id' | 'text' | 'x' | 'y'> = like
    ? { sizeMm: like.sizeMm, font: like.font, bold: like.bold, italic: like.italic, underline: like.underline, color: like.color, align: like.align, rotation: 0, shadow: like.shadow }
    : { sizeMm: clampTextSize(Math.min(sheet.widthMm, sheet.heightMm) / 12), font: 'roboto', bold: true, italic: false, underline: false, color: '#ffffff', align: 'center', rotation: 0, shadow: true };
  // Next to the previous caption rather than on top of it.
  const y = like ? (like.y < 0.8 ? like.y + 0.12 : 0.2) : 0.5;
  return cleanText({ id, text: NEW_TEXT, x: 0.5, y, ...base });
}

/** CSS / canvas font for the caption at `sizePx`. */
export function fontCss(t: Pick<TextBox, 'font' | 'bold' | 'italic'>, sizePx: number): string {
  const f = fontInfo(t.font);
  return `${t.italic ? 'italic ' : ''}${t.bold ? 700 : 400} ${sizePx}px "${f.family}", ${f.fallback}`;
}

/** Text size and the font's vertical metrics, for a font of `REF_PX` pixels. */
export interface Metrics {
  width: number;
  /** Font ascent and descent (as CSS uses them to place the baseline in a line). */
  ascent: number;
  descent: number;
}
export type Measure = (text: string, font: string) => Metrics;
/** Font size the text is measured at; the result is scaled to the caption's size. */
export const REF_PX = 100;

export interface TextLine {
  text: string;
  /** Left edge and top of the line box, relative to the caption's top-left corner (mm). */
  x: number;
  top: number;
  width: number;
  /** Baseline, relative to the caption's top (mm). */
  baseline: number;
}

export interface TextLayout {
  /** Size of the caption's box (mm), centred on the caption's position. */
  w: number;
  h: number;
  /** Centre on the sheet (mm). */
  cx: number;
  cy: number;
  lineHeight: number;
  lines: TextLine[];
  /** Underline thickness and its distance below the baseline (mm). */
  underline: { offset: number; thickness: number };
}

export const textLines = (text: string) => text.replace(/\r\n?/g, '\n').split('\n');

/** Where every line of the caption goes – the same for the preview and the export. */
export function layoutText(t: TextBox, sheet: Pick<Sheet, 'widthMm' | 'heightMm'>, measure: Measure): TextLayout {
  const k = t.sizeMm / REF_PX;
  const font = fontCss(t, REF_PX);
  const lineHeight = t.sizeMm * LINE_HEIGHT;
  const measured = textLines(t.text).map((text) => ({ text, m: measure(text, font) }));
  const w = Math.max(0, ...measured.map((l) => l.m.width * k));
  const lines = measured.map(({ text, m }, i) => {
    const width = m.width * k;
    const x = t.align === 'left' ? 0 : t.align === 'right' ? w - width : (w - width) / 2;
    const top = i * lineHeight;
    // As in CSS: the font's ascent + descent is centred in the line box.
    const ascent = m.ascent * k;
    const descent = m.descent * k;
    return { text, x, top, width, baseline: top + (lineHeight - ascent - descent) / 2 + ascent };
  });
  return {
    w,
    h: lines.length * lineHeight,
    cx: t.x * sheet.widthMm,
    cy: t.y * sheet.heightMm,
    lineHeight,
    lines,
    underline: { offset: t.sizeMm * 0.1, thickness: Math.max(0.2, t.sizeMm * 0.06) },
  };
}

/** Shadow of a caption, in multiples of the font size. */
export const SHADOW = { offset: 0.05, blur: 0.15, color: 'rgba(0,0,0,0.6)' } as const;

/** Moves the caption by (dx, dy) millimetres; the centre stays on the sheet. */
export function moveText(t: TextBox, dx: number, dy: number, sheet: Pick<Sheet, 'widthMm' | 'heightMm'>): Pick<TextBox, 'x' | 'y'> {
  return { x: clamp01(t.x + dx / sheet.widthMm), y: clamp01(t.y + dy / sheet.heightMm) };
}
