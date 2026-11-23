import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { currentTree } from '../../core/doc';
import { junctions } from '../../core/edges';
import { computeLayout } from '../../core/geometry';
import { layoutText, type TextBox } from '../../core/text';
import type { Crop } from '../../core/types';
import { loadFonts, useTextMeasure } from '../../fonts';
import type { Mosaic } from '../../hooks/useMosaic';
import { Cell } from './Cell';
import { Divider, JunctionKnob } from './Divider';
import { TextFrame, TextItem } from './TextItem';
import { useEdgeDrag } from './useEdgeDrag';

interface Props {
  mosaic: Mosaic;
  /** Available space in screen pixels. */
  width: number;
  height: number;
  swapMode: boolean;
  selectedText: string | null;
  onSelectText: (id: string | null) => void;
  /** Double click on a caption – edit its text. */
  onEditText: (id: string) => void;
}

interface SwapDrag {
  from: string;
  x: number;
  y: number;
  over: string | null;
}

/** An empty caption is shown with a placeholder, so it can still be found and moved. */
const shown = (t: TextBox): TextBox => (t.text.trim() ? t : { ...t, text: 'Napis' });

const leafAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-leaf-id]')?.dataset.leafId ?? null;

/** The sheet as on paper: every position comes from computeLayout(), the same as in the exported file. */
export function SheetView({ mosaic, width, height, swapMode, selectedText, onSelectText, onEditText }: Props) {
  const { doc, act, endGesture, urlOf } = mosaic;
  const { sheet } = doc;
  const scale = Math.max(0, Math.min(width / sheet.widthMm, height / sheet.heightMm));
  const tree = currentTree(doc);
  const layout = useMemo(() => computeLayout(tree, sheet), [tree, sheet]);
  const photos = useMemo(() => new Map(doc.photos.map((p) => [p.id, p])), [doc.photos]);
  const [active, setActive] = useState<string | null>(null);
  const texts = useMemo(() => doc.texts ?? [], [doc.texts]);
  const measure = useTextMeasure();
  useEffect(() => {
    void loadFonts(texts);
  }, [texts]);
  const textLayouts = useMemo(() => new Map(texts.map((t) => [t.id, layoutText(shown(t), sheet, measure)])), [texts, sheet, measure]);
  const onTextChange = useCallback(
    (id: string, patch: Partial<Omit<TextBox, 'id'>>, transient: boolean) => act({ type: 'updateText', id, patch }, { transient }),
    [act],
  );
  const selected = texts.find((t) => t.id === selectedText);
  const [drag, setDrag] = useState<SwapDrag | null>(null);

  // Swapping by dragging one photo onto another – pointer events, so it works with a finger too.
  const onSwapStart = useCallback((leafId: string, e: ReactPointerEvent) => {
    e.preventDefault();
    setDrag({ from: leafId, x: e.clientX, y: e.clientY, over: null });
  }, []);
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const over = leafAt(e.clientX, e.clientY);
      setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY, over });
    };
    const up = (e: PointerEvent) => {
      const over = leafAt(e.clientX, e.clientY);
      setDrag((d) => {
        if (d && over && over !== d.from) act({ type: 'swap', leafA: d.from, leafB: over });
        return null;
      });
    };
    const cancel = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [dragging, act]);

  const onCrop = useCallback((photoId: string, crop: Crop, transient: boolean) => act({ type: 'setCrop', photoId, crop }, { transient }), [act]);
  const onRemove = useCallback((photoId: string) => act({ type: 'toMagazine', photoId }), [act]);

  const sheetRef = useRef<HTMLDivElement>(null);
  const edges = useEdgeDrag({ tree, sheet, scale, sheetRef, act, endGesture });
  const crossings = useMemo(() => junctions(layout), [layout]);

  const dragPhoto = drag && layout.cells.find((c) => c.leafId === drag.from);

  return (
    <div
      ref={sheetRef}
      data-testid="sheet"
      className="relative shadow-2xl"
      style={{ width: sheet.widthMm * scale, height: sheet.heightMm * scale, backgroundColor: sheet.frameColor }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setActive(null);
        if (!(e.target as HTMLElement).closest('[data-testid=text-box],[data-testid=text-frame]')) onSelectText(null);
      }}
    >
      {layout.cells.map((cell) => {
        const photo = photos.get(cell.photoId);
        if (!photo) return null;
        return (
          <Cell
            key={cell.leafId}
            cell={cell}
            photo={photo}
            url={urlOf(photo.id)}
            scale={scale}
            radiusMm={sheet.radiusMm}
            swapMode={swapMode}
            active={active === cell.leafId}
            dragging={drag?.from === cell.leafId}
            dropTarget={!!drag && drag.over === cell.leafId && drag.over !== drag.from}
            onActivate={setActive}
            onCrop={onCrop}
            onEnd={endGesture}
            onRemove={onRemove}
            onSwapStart={onSwapStart}
          />
        );
      })}
      {!swapMode &&
        layout.dividers.map((d) => (
          <Divider key={d.splitId} divider={d} scale={scale} active={edges.active === d.splitId} onGrab={edges.onGrabEdge} />
        ))}
      {!swapMode &&
        crossings.map((j) => (
          <JunctionKnob
            key={`${j.x.toFixed(2)}:${j.y.toFixed(2)}`}
            junction={j}
            scale={scale}
            active={!!edges.active && (j.vertical.includes(edges.active) || j.horizontal.includes(edges.active))}
            onGrab={edges.onGrabJunction}
          />
        ))}
      {texts.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" data-testid="text-layer">
          {texts.map((t) => (
            <TextItem
              key={t.id}
              box={t}
              layout={textLayouts.get(t.id)!}
              filled={!!t.text.trim()}
              sheet={sheet}
              scale={scale}
              selected={t.id === selectedText}
              onSelect={onSelectText}
              onChange={onTextChange}
              onEnd={endGesture}
              onEdit={onEditText}
            />
          ))}
        </div>
      )}
      {selected && textLayouts.get(selected.id) && (
        <TextFrame box={selected} layout={textLayouts.get(selected.id)!} scale={scale} onChange={onTextChange} onEnd={endGesture} />
      )}
      {drag && dragPhoto && (
        <img
          src={urlOf(dragPhoto.photoId)}
          alt=""
          className="pointer-events-none fixed z-50 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-lg object-cover opacity-80 shadow-xl ring-2 ring-white"
          style={{ left: drag.x, top: drag.y }}
          data-testid="swap-ghost"
        />
      )}
    </div>
  );
}
