/** Popular print sizes, portrait orientation (width ≤ height), in millimetres. */
export interface Format {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const FORMATS: Format[] = [
  { id: 'a4', label: 'A4 (21 × 29,7 cm)', widthMm: 210, heightMm: 297 },
  { id: 'a3', label: 'A3 (29,7 × 42 cm)', widthMm: 297, heightMm: 420 },
  { id: 'a2', label: 'A2 (42 × 59,4 cm)', widthMm: 420, heightMm: 594 },
  { id: '20x30', label: '20 × 30 cm', widthMm: 200, heightMm: 300 },
  { id: '30x40', label: '30 × 40 cm', widthMm: 300, heightMm: 400 },
  { id: '40x50', label: '40 × 50 cm', widthMm: 400, heightMm: 500 },
  { id: '50x50', label: '50 × 50 cm', widthMm: 500, heightMm: 500 },
  { id: '50x70', label: '50 × 70 cm', widthMm: 500, heightMm: 700 },
];

/** The preset matching the size in either orientation, or undefined for a custom size. */
export function matchFormat(widthMm: number, heightMm: number): Format | undefined {
  const [a, b] = widthMm <= heightMm ? [widthMm, heightMm] : [heightMm, widthMm];
  return FORMATS.find((f) => f.widthMm === a && f.heightMm === b);
}

/** Size of a preset, keeping the current orientation (landscape stays landscape). */
export function applyFormat(format: Format, current: { widthMm: number; heightMm: number }): { widthMm: number; heightMm: number } {
  const landscape = current.widthMm > current.heightMm;
  return landscape ? { widthMm: format.heightMm, heightMm: format.widthMm } : { widthMm: format.widthMm, heightMm: format.heightMm };
}

export const MIN_SIDE_MM = 10;
export const MAX_SIDE_MM = 2000;

export function clampSide(mm: number): number {
  if (!Number.isFinite(mm)) return MIN_SIDE_MM;
  return Math.min(MAX_SIDE_MM, Math.max(MIN_SIDE_MM, Math.round(mm)));
}
