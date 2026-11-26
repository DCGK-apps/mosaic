import type { Dir, Node, Rect, Sheet } from './types';

export interface CellBox extends Rect {
  leafId: string;
  photoId: string;
}

export interface DividerBox extends Rect {
  splitId: string;
  dir: Dir;
  /** Length along which the divider moves (the split's size minus the gap). */
  available: number;
  frac: number;
}

export interface Layout {
  cells: CellBox[];
  dividers: DividerBox[];
}

/** What the layout needs to know about the sheet. */
export type LayoutSheet = Pick<Sheet, 'widthMm' | 'heightMm' | 'gapMm' | 'outerFrame'>;

/** The part of the sheet the photos fill: all of it, or inside a frame as wide as the gap around the edges. */
export function sheetArea(sheet: LayoutSheet): Rect {
  const w = Math.max(0, sheet.widthMm);
  const h = Math.max(0, sheet.heightMm);
  if (!sheet.outerFrame) return { x: 0, y: 0, w, h };
  // A frame wider than the sheet would leave no room; a tenth of the shorter side always stays for the photos.
  const m = Math.min(Math.max(0, sheet.gapMm), (Math.min(w, h) * 0.9) / 2);
  return { x: m, y: m, w: w - 2 * m, h: h - 2 * m };
}

/**
 * Positions of all cells and dividers, in millimetres of the sheet.
 * The single source of truth for both the on-screen preview and the export,
 * so the saved file looks exactly like the screen.
 */
export function computeLayout(tree: Node | null, sheet: LayoutSheet): Layout {
  const out: Layout = { cells: [], dividers: [] };
  if (!tree) return out;
  const gap = Math.max(0, sheet.gapMm);
  const walk = (node: Node, r: Rect): void => {
    if (node.kind === 'leaf') {
      out.cells.push({ ...r, leafId: node.id, photoId: node.photoId });
      return;
    }
    const vertical = node.dir === 'V';
    const length = vertical ? r.w : r.h;
    const g = Math.min(gap, length);
    const available = length - g;
    const first = available * node.frac;
    const second = available - first;
    if (vertical) {
      walk(node.a, { x: r.x, y: r.y, w: first, h: r.h });
      out.dividers.push({ splitId: node.id, dir: 'V', x: r.x + first, y: r.y, w: g, h: r.h, available, frac: node.frac });
      walk(node.b, { x: r.x + first + g, y: r.y, w: second, h: r.h });
    } else {
      walk(node.a, { x: r.x, y: r.y, w: r.w, h: first });
      out.dividers.push({ splitId: node.id, dir: 'H', x: r.x, y: r.y + first, w: r.w, h: g, available, frac: node.frac });
      walk(node.b, { x: r.x, y: r.y + first + g, w: r.w, h: second });
    }
  };
  walk(tree, sheetArea(sheet));
  return out;
}

/** Corner radius that fits the cell (CSS and canvas both cap it at half the shorter side). */
export function cellRadius(radiusMm: number, cell: Rect): number {
  return Math.max(0, Math.min(radiusMm, cell.w / 2, cell.h / 2));
}
