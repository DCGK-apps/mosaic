import { DEFAULT_CROP } from '../core/crop';
import { DEFAULT_SHEET, docReducer, emptyDoc } from '../core/doc';
import { removePhoto } from '../core/tree';
import type { Crop, Doc, LayoutMode, Node, Photo, Sheet } from '../core/types';

export const SAVE_VERSION = 1;

export interface SavedDoc {
  version: number;
  doc: Doc;
}

export function toSaved(doc: Doc): SavedDoc {
  return { version: SAVE_VERSION, doc };
}

const MODES: LayoutMode[] = ['auto', 'grid', 'central', 'rows', 'cols'];
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function parseCrop(v: unknown): Crop {
  if (!isObj(v)) return { ...DEFAULT_CROP };
  return { x: num(v.x, 0), y: num(v.y, 0), zoom: num(v.zoom, 1) };
}

function parsePhoto(v: unknown): Photo | null {
  if (!isObj(v) || !str(v.id)) return null;
  const width = num(v.width, 0);
  const height = num(v.height, 0);
  if (width <= 0 || height <= 0) return null;
  return { id: v.id, name: typeof v.name === 'string' ? v.name : '', width, height, crop: parseCrop(v.crop) };
}

function parseNode(v: unknown): Node | null {
  if (!isObj(v) || !str(v.id)) return null;
  if (v.kind === 'leaf') return str(v.photoId) ? { kind: 'leaf', id: v.id, photoId: v.photoId } : null;
  if (v.kind !== 'split' || (v.dir !== 'V' && v.dir !== 'H')) return null;
  const a = parseNode(v.a);
  const b = parseNode(v.b);
  if (!a || !b) return null;
  return { kind: 'split', id: v.id, dir: v.dir, frac: num(v.frac, 0.5), a, b };
}

function parseSheet(v: unknown): Sheet {
  const s = isObj(v) ? v : {};
  return {
    widthMm: num(s.widthMm, DEFAULT_SHEET.widthMm),
    heightMm: num(s.heightMm, DEFAULT_SHEET.heightMm),
    gapMm: num(s.gapMm, DEFAULT_SHEET.gapMm),
    radiusMm: num(s.radiusMm, DEFAULT_SHEET.radiusMm),
    frameColor: typeof s.frameColor === 'string' && /^#[0-9a-f]{6}$/i.test(s.frameColor) ? s.frameColor : DEFAULT_SHEET.frameColor,
  };
}

/**
 * Rebuilds a document from saved data. Anything broken is replaced with a
 * default; photos whose image is missing (`hasImage` false) are left out.
 */
export function restoreDoc(raw: unknown, hasImage: (photoId: string) => boolean): Doc | null {
  if (!isObj(raw) || raw.version !== SAVE_VERSION || !isObj(raw.doc)) return null;
  const d = raw.doc;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(parsePhoto).filter((p): p is Photo => !!p) : []);
  const all = [...list(d.photos), ...list(d.magazine)];
  const missing = new Set(all.filter((p) => !hasImage(p.id)).map((p) => p.id));
  const keep = (p: Photo) => !missing.has(p.id);

  const prune = (tree: Node | null): Node | null => {
    let t = tree;
    for (const id of missing) t = t && removePhoto(t, id);
    return t;
  };

  const base = emptyDoc();
  const mode = MODES.includes(d.mode as LayoutMode) ? (d.mode as LayoutMode) : base.mode;
  const autoHistory = (Array.isArray(d.autoHistory) ? d.autoHistory : [])
    .map(parseNode)
    .map((n) => prune(n))
    .filter((n): n is Node => !!n);
  let doc: Doc = {
    photos: list(d.photos).filter(keep),
    magazine: list(d.magazine).filter(keep),
    sheet: parseSheet(d.sheet),
    mode,
    tree: prune(parseNode(d.tree)),
    autoHistory,
    autoIndex: Math.min(Math.max(0, Math.floor(num(d.autoIndex, 0))), Math.max(0, autoHistory.length - 1)),
  };
  // Clamp the sheet values through the reducer, so the limits live in one place.
  doc = docReducer(doc, { type: 'setSheet', patch: {} });
  return doc;
}
