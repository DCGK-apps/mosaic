import { clampSide } from './formats';
import { autoLayout, fixedLayout } from './layouts';
import { createRng } from './random';
import { leaves, removePhoto, setFrac, swapLeaves } from './tree';
import type { Crop, Doc, LayoutMode, Node, Photo, Sheet } from './types';

export const DEFAULT_SHEET: Sheet = { widthMm: 504, heightMm: 506, gapMm: 5, radiusMm: 0, frameColor: '#ffffff' };
export const MAX_GAP_MM = 30;
export const MAX_RADIUS_MM = 50;
export const AUTO_HISTORY_LIMIT = 50;

export function emptyDoc(): Doc {
  return { photos: [], magazine: [], sheet: { ...DEFAULT_SHEET }, mode: 'auto', tree: null, autoHistory: [], autoIndex: 0 };
}

/** The layout currently on the sheet. */
export function currentTree(doc: Doc): Node | null {
  return doc.mode === 'auto' ? (doc.autoHistory[doc.autoIndex] ?? null) : doc.tree;
}

export type DocAction =
  | { type: 'addPhotos'; photos: Photo[]; seed: number }
  | { type: 'toMagazine'; photoId: string; seed: number }
  | { type: 'fromMagazine'; photoId: string; seed: number }
  | { type: 'deleteFromMagazine'; photoId: string }
  | { type: 'setMode'; mode: LayoutMode; seed: number }
  | { type: 'shuffle'; seed: number }
  | { type: 'autoStep'; delta: number }
  | { type: 'setFrac'; splitId: string; frac: number }
  | { type: 'swap'; leafA: string; leafB: string }
  | { type: 'setCrop'; photoId: string; crop: Crop }
  | { type: 'setSheet'; patch: Partial<Sheet> }
  | { type: 'rotateSheet' };

function withTree(doc: Doc, tree: Node | null): Doc {
  if (doc.mode !== 'auto') return { ...doc, tree };
  if (!tree) return { ...doc, autoHistory: [], autoIndex: 0 };
  const autoHistory = [...doc.autoHistory];
  autoHistory[doc.autoIndex] = tree;
  return { ...doc, autoHistory };
}

/** True when the layout shows exactly the photos on the sheet. */
function fits(tree: Node | null | undefined, photos: Photo[]): boolean {
  if (!tree) return photos.length === 0;
  const ids = leaves(tree).map((l) => l.photoId).toSorted();
  const want = photos.map((p) => p.id).toSorted();
  return ids.length === want.length && ids.every((id, i) => id === want[i]);
}

/**
 * A fresh layout of the current photos in the current mode. In a fixed mode
 * the drawn auto layouts are kept – `setMode` brings them back if they still
 * show the same photos.
 */
function relayout(doc: Doc, seed: number): Doc {
  const rng = createRng(seed);
  if (doc.photos.length === 0) return { ...doc, tree: null, autoHistory: [], autoIndex: 0 };
  if (doc.mode === 'auto') return { ...doc, tree: null, autoHistory: [autoLayout(doc.photos, doc.sheet, rng)!], autoIndex: 0 };
  return { ...doc, tree: fixedLayout(doc.mode, doc.photos, rng) };
}

export function docReducer(doc: Doc, action: DocAction): Doc {
  switch (action.type) {
    case 'addPhotos':
      if (action.photos.length === 0) return doc;
      return relayout({ ...doc, photos: [...doc.photos, ...action.photos] }, action.seed);

    case 'toMagazine': {
      const photo = doc.photos.find((p) => p.id === action.photoId);
      if (!photo) return doc;
      const next = { ...doc, photos: doc.photos.filter((p) => p !== photo), magazine: [...doc.magazine, photo] };
      const tree = currentTree(doc);
      // Auto: the rest of the drawn layout stays, the neighbour fills the gap.
      if (doc.mode === 'auto' && tree) {
        const rest = removePhoto(tree, photo.id);
        return rest ? { ...next, autoHistory: [rest], autoIndex: 0 } : relayout(next, action.seed);
      }
      return relayout(next, action.seed);
    }

    case 'fromMagazine': {
      const photo = doc.magazine.find((p) => p.id === action.photoId);
      if (!photo) return doc;
      return relayout({ ...doc, magazine: doc.magazine.filter((p) => p !== photo), photos: [...doc.photos, photo] }, action.seed);
    }

    case 'deleteFromMagazine':
      return { ...doc, magazine: doc.magazine.filter((p) => p.id !== action.photoId) };

    case 'setMode': {
      if (action.mode === doc.mode) return doc;
      const next = { ...doc, mode: action.mode };
      if (action.mode === 'auto' && fits(doc.autoHistory[doc.autoIndex], doc.photos)) return next;
      return relayout(next, action.seed);
    }

    case 'shuffle': {
      if (doc.mode !== 'auto' || doc.photos.length === 0) return doc;
      const tree = autoLayout(doc.photos, doc.sheet, createRng(action.seed))!;
      const autoHistory = [...doc.autoHistory, tree].slice(-AUTO_HISTORY_LIMIT);
      return { ...doc, autoHistory, autoIndex: autoHistory.length - 1 };
    }

    case 'autoStep': {
      const autoIndex = Math.min(doc.autoHistory.length - 1, Math.max(0, doc.autoIndex + action.delta));
      return autoIndex === doc.autoIndex ? doc : { ...doc, autoIndex };
    }

    case 'setFrac': {
      const tree = currentTree(doc);
      if (!tree) return doc;
      const next = setFrac(tree, action.splitId, action.frac);
      return next === tree ? doc : withTree(doc, next);
    }

    case 'swap': {
      const tree = currentTree(doc);
      if (!tree) return doc;
      const next = swapLeaves(tree, action.leafA, action.leafB);
      return next === tree ? doc : withTree(doc, next);
    }

    case 'setCrop': {
      const { crop } = action;
      let changed = false;
      const photos = doc.photos.map((p) => {
        if (p.id !== action.photoId || (p.crop.x === crop.x && p.crop.y === crop.y && p.crop.zoom === crop.zoom)) return p;
        changed = true;
        return { ...p, crop };
      });
      return changed ? { ...doc, photos } : doc;
    }

    case 'setSheet': {
      const sheet = { ...doc.sheet, ...action.patch };
      sheet.widthMm = clampSide(sheet.widthMm);
      sheet.heightMm = clampSide(sheet.heightMm);
      sheet.gapMm = Math.min(MAX_GAP_MM, Math.max(0, sheet.gapMm || 0));
      sheet.radiusMm = Math.min(MAX_RADIUS_MM, Math.max(0, sheet.radiusMm || 0));
      const same = (Object.keys(sheet) as (keyof Sheet)[]).every((k) => sheet[k] === doc.sheet[k]);
      return same ? doc : { ...doc, sheet };
    }

    case 'rotateSheet':
      return { ...doc, sheet: { ...doc.sheet, widthMm: doc.sheet.heightMm, heightMm: doc.sheet.widthMm } };
  }
}
