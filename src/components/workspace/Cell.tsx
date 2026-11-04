import { ArrowLeftRight, Minus, Move, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { imageRect, panCrop, setZoom, ZOOM_STEP } from '../../core/crop';
import { cellRadius, type CellBox } from '../../core/geometry';
import type { Crop, Photo } from '../../core/types';
import { cx } from '../cx';

/** Movement (px) below which a press counts as a tap. */
const TAP_SLOP = 4;

export interface CellProps {
  cell: CellBox;
  photo: Photo;
  url: string | undefined;
  /** Screen pixels per millimetre. */
  scale: number;
  radiusMm: number;
  swapMode: boolean;
  /** Tapped on a touch screen – shows the controls that otherwise appear on hover. */
  active: boolean;
  /** Being dragged to another cell (swap mode). */
  dragging: boolean;
  dropTarget: boolean;
  onActivate: (leafId: string | null) => void;
  onCrop: (photoId: string, crop: Crop, transient: boolean) => void;
  onEnd: () => void;
  onRemove: (photoId: string) => void;
  onSwapStart: (leafId: string, e: ReactPointerEvent) => void;
}

export function Cell(props: CellProps) {
  const { cell, photo, url, scale, swapMode, active } = props;
  const el = useRef<HTMLDivElement>(null);
  const crop = useRef(photo.crop);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinch: 0, zoom: 1 });
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
    if (pointers.current.size === 0) crop.current = photo.crop;
  });

  // Mouse wheel zoom (native listener – React's wheel listener is passive, it cannot stop page scrolling).
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const timer = { id: 0 };
    const onWheel = (e: WheelEvent) => {
      const p = latest.current;
      if (p.swapMode) return;
      e.preventDefault();
      const next = setZoom(p.photo.crop, p.photo.crop.zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
      p.onCrop(p.photo.id, next, true);
      clearTimeout(timer.id);
      timer.id = window.setTimeout(() => latest.current.onEnd(), 300);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
      clearTimeout(timer.id);
    };
  }, []);

  const resetPinch = () => {
    const pts = [...pointers.current.values()];
    gesture.current.pinch = pts.length >= 2 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0;
    gesture.current.zoom = crop.current.zoom;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (swapMode) {
      props.onSwapStart(cell.leafId, e);
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.current.size === 0) {
      crop.current = photo.crop;
      gesture.current.moved = 0;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    resetPinch();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    const g = gesture.current;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (g.pinch > 0) crop.current = setZoom(crop.current, (g.zoom * dist) / g.pinch);
      g.moved += TAP_SLOP + 1;
    } else {
      const dx = now.x - prev.x;
      const dy = now.y - prev.y;
      g.moved += Math.abs(dx) + Math.abs(dy);
      if (g.moved <= TAP_SLOP) return;
      crop.current = panCrop(crop.current, photo, cell, dx / scale, dy / scale);
    }
    props.onCrop(photo.id, crop.current, true);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    resetPinch();
    if (pointers.current.size > 0) return;
    if (gesture.current.moved > TAP_SLOP) props.onEnd();
    else props.onActivate(active ? null : cell.leafId);
  };

  const zoomBy = (delta: number) => props.onCrop(photo.id, setZoom(photo.crop, photo.crop.zoom + delta), false);
  const r = imageRect(photo, cell);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div
      ref={el}
      data-testid="cell"
      data-leaf-id={cell.leafId}
      data-photo-id={photo.id}
      data-active={active || undefined}
      style={{
        left: cell.x * scale,
        top: cell.y * scale,
        width: cell.w * scale,
        height: cell.h * scale,
        borderRadius: cellRadius(props.radiusMm, cell) * scale,
        opacity: props.dragging ? 0.4 : 1,
      }}
      className={cx(
        'group absolute touch-none overflow-hidden bg-slate-100 transition-opacity',
        swapMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-move',
        props.dropTarget && 'outline outline-4 -outline-offset-4 outline-brand',
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {url && (
        <img
          src={url}
          alt={photo.name || 'kadr kolażu'}
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: (r.x - cell.x) * scale, top: (r.y - cell.y) * scale, width: r.w * scale, height: r.h * scale }}
        />
      )}

      <div className={cx('pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100', swapMode ? 'bg-brand/20' : 'bg-black/10')}>
        {swapMode ? <ArrowLeftRight className="h-8 w-8 text-white drop-shadow-md" /> : <Move className="h-8 w-8 text-white drop-shadow-md" />}
      </div>

      <button
        type="button"
        className={cx(
          'absolute right-2 top-2 z-20 rounded bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 focus-visible:opacity-100 group-hover:opacity-100',
          active && 'opacity-100',
        )}
        onPointerDown={stop}
        onClick={() => props.onRemove(photo.id)}
        title="Usuń do magazynu"
        aria-label="Usuń do magazynu"
        data-testid="cell-remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {!swapMode && (
        <div
          className={cx(
            'absolute bottom-2 right-2 z-20 flex overflow-hidden rounded bg-black/60 text-white opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100',
            active && 'opacity-100',
          )}
          onPointerDown={stop}
        >
          <button type="button" onClick={() => zoomBy(-ZOOM_STEP)} className="p-1.5 hover:bg-slate-700" title="Zmniejsz" aria-label="Zmniejsz" data-testid="zoom-out">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="flex min-w-[36px] items-center justify-center px-1 text-[10px] font-bold" data-testid="zoom-value">
            {Math.round(photo.crop.zoom * 100)}%
          </span>
          <button type="button" onClick={() => zoomBy(ZOOM_STEP)} className="p-1.5 hover:bg-slate-700" title="Powiększ" aria-label="Powiększ" data-testid="zoom-in">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
