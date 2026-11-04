/**
 * Data model of a mosaic. Everything here is plain, serialisable data: the
 * image bytes live outside the document (see storage/ and hooks/useImages).
 */

/** `V` – a vertical divider (children side by side), `H` – a horizontal one (stacked). */
export type Dir = 'V' | 'H';

export interface Leaf {
  kind: 'leaf';
  id: string;
  photoId: string;
}

export interface Split {
  kind: 'split';
  id: string;
  dir: Dir;
  /** Share of the available length (without the gap) taken by `a`, 0..1. */
  frac: number;
  /** Left (V) or top (H) part. */
  a: Node;
  /** Right (V) or bottom (H) part. */
  b: Node;
}

export type Node = Leaf | Split;

/**
 * How a photo sits in its cell. The photo always covers the whole cell
 * ("cover"), so there is never an empty gap inside a cell:
 * - `zoom` ≥ 1 magnifies it further,
 * - `x`/`y` in -1..1 move it within the part that overflows the cell
 *   (0 = centred, -1 = left/top edge of the photo at the cell edge… etc.).
 */
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

export interface Photo {
  id: string;
  name: string;
  /** Natural size in pixels – only the aspect ratio matters for the layout. */
  width: number;
  height: number;
  crop: Crop;
}

export interface Sheet {
  widthMm: number;
  heightMm: number;
  /** Frame between photos, in millimetres of the printed sheet. */
  gapMm: number;
  /** Corner radius of every photo, in millimetres. */
  radiusMm: number;
  /** Colour of the frame (the sheet background). */
  frameColor: string;
}

export type LayoutMode = 'auto' | 'grid' | 'central' | 'rows' | 'cols';

export interface Doc {
  /** Photos placed on the sheet, in the order they were added. */
  photos: Photo[];
  /** Photos put aside ("Magazyn odłożonych"). */
  magazine: Photo[];
  sheet: Sheet;
  mode: LayoutMode;
  /** Layout for the non-auto modes. */
  tree: Node | null;
  /** Layouts drawn in the auto mode – the user can browse them. */
  autoHistory: Node[];
  autoIndex: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
