import { ChevronRight, Download, GalleryVerticalEnd, LayoutDashboard, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { currentTree } from '../core/doc';
import { drawMosaic } from '../core/export';
import type { Doc } from '../core/types';
import type { Mosaic } from '../hooks/useMosaic';
import { loadFonts } from '../fonts';
import { loadImage } from '../images';
import { cx } from './cx';

/** Decoded previews, shared by all thumbnails (one photo is in one collage, but it is redrawn on every edit). */
const decoded = new Map<string, Promise<HTMLImageElement>>();
function decode(url: string): Promise<HTMLImageElement> {
  let p = decoded.get(url);
  if (!p) {
    p = loadImage(url);
    p.catch(() => decoded.delete(url));
    decoded.set(url, p);
    // Keep the cache bounded – a series has at most a few hundred photos.
    if (decoded.size > 1500) decoded.delete(decoded.keys().next().value!);
  }
  return p;
}

const THUMB_W = 200;

/** A small picture of one collage, drawn with the same code as the export. */
function CollageThumb({ doc, thumbOf }: { doc: Doc; thumbOf: (id: string) => string | undefined }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ratio = doc.sheet.heightMm / doc.sheet.widthMm;

  useEffect(() => {
    const run = { cancelled: false };
    void (async () => {
      const images = new Map<string, HTMLImageElement>();
      await loadFonts(doc.texts ?? []);
      await Promise.all(
        doc.photos.map(async (p) => {
          const url = thumbOf(p.id);
          if (!url) return;
          try {
            images.set(p.id, await decode(url));
          } catch {
            /* left empty */
          }
        }),
      );
      const c = canvas.current;
      const ctx = c?.getContext('2d');
      if (run.cancelled || !c || !ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(THUMB_W * dpr);
      c.height = Math.round(THUMB_W * ratio * dpr);
      drawMosaic(ctx, { tree: currentTree(doc), sheet: doc.sheet, photos: doc.photos, texts: doc.texts }, images, c.width / doc.sheet.widthMm);
      c.dataset.drawn = 'true';
    })();
    return () => {
      run.cancelled = true;
    };
  }, [doc, ratio, thumbOf]);

  return <canvas ref={canvas} className="block w-full rounded-sm bg-slate-200 shadow" style={{ aspectRatio: `${doc.sheet.widthMm} / ${doc.sheet.heightMm}` }} data-testid="batch-canvas" />;
}

interface Props {
  mosaic: Mosaic;
  open: boolean;
  onOpen: (open: boolean) => void;
  onSaveAll: () => void;
  onNewSeries: () => void;
}

/** The collages of the automatic series, on the right side of the screen (computer only). */
export function BatchPanel({ mosaic, open, onOpen, onSaveAll, onNewSeries }: Props) {
  const { batch, doc: edited, thumbOf, selectBatch, closeBatch } = mosaic;
  const [confirmClose, setConfirmClose] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const activeKey = edited.batchKey;

  useEffect(() => {
    if (!open || !activeKey) return;
    list.current?.querySelector(`[data-key="${activeKey}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeKey, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpen(true)}
        className="flex w-10 shrink-0 flex-col items-center gap-3 border-l border-slate-200 bg-white py-4 text-slate-600 shadow-lg hover:bg-slate-50 hover:text-brand"
        title="Pokaż kolaże"
        data-testid="batch-toggle"
      >
        <GalleryVerticalEnd className="h-5 w-5" />
        <span className="text-xs font-bold [writing-mode:vertical-rl]">Kolaże ({batch.length})</span>
      </button>
    );
  }

  return (
    <aside className="z-20 flex w-64 shrink-0 flex-col border-l border-slate-200 bg-white shadow-lg" data-testid="batch-panel">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <GalleryVerticalEnd className="h-4 w-4 text-brand" /> Kolaże ({batch.length})
        </h2>
        <button type="button" onClick={() => onOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Schowaj panel" aria-label="Schowaj panel" data-testid="batch-hide">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2 border-b border-slate-200 p-3">
        <button
          type="button"
          onClick={onSaveAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-800"
          data-testid="batch-save-all"
        >
          <Download className="h-4 w-4" /> Zapisz wszystkie
        </button>
        {confirmClose ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800" data-testid="batch-close-confirm">
            Zamknąć serię? Niezapisane kolaże znikną. Kolaż na arkuszu zostaje.
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false);
                  closeBatch();
                }}
                className="flex-1 rounded bg-red-600 py-1 font-bold text-white hover:bg-red-700"
                data-testid="batch-close-yes"
              >
                Zamknij
              </button>
              <button type="button" onClick={() => setConfirmClose(false)} className="flex-1 rounded py-1 font-bold text-slate-600 hover:bg-white">
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onNewSeries} className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 py-1.5 text-xs font-bold text-slate-600 hover:border-brand hover:text-brand">
              <LayoutDashboard className="h-3.5 w-3.5" /> Nowa seria
            </button>
            <button
              type="button"
              onClick={() => setConfirmClose(true)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 py-1.5 text-xs font-bold text-slate-600 hover:border-red-400 hover:text-red-600"
              data-testid="batch-close"
            >
              <X className="h-3.5 w-3.5" /> Zamknij serię
            </button>
          </div>
        )}
      </div>

      <div ref={list} className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3" data-testid="batch-list">
        {batch.map((d, i) => {
          const active = d.batchKey === activeKey;
          const shown = active ? edited : d;
          return (
            <button
              key={d.batchKey}
              type="button"
              data-key={d.batchKey}
              data-testid="batch-item"
              aria-current={active || undefined}
              onClick={() => selectBatch(d.batchKey!)}
              className={cx('block w-full rounded-lg p-2 text-left transition-colors', active ? 'bg-blue-50 ring-2 ring-brand' : 'hover:bg-slate-100')}
            >
              <CollageThumb doc={shown} thumbOf={thumbOf} />
              <span className="mt-1 flex justify-between text-[11px] text-slate-500">
                <b className={active ? 'text-brand' : 'text-slate-700'}>{String(i + 1).padStart(3, '0')}</b>
                <span>{shown.photos.length} zdj.</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="border-t border-slate-200 p-3 text-[11px] leading-snug text-slate-500">
        Kliknij kolaż, aby go poprawić. Zdjęcia usunięte z kolażu trafiają do magazynu odłożonych – można je dodać do innego kolażu serii.
      </p>
    </aside>
  );
}
