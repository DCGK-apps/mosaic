import { RotateCw } from 'lucide-react';
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { fontInfo, moveText, normalizeAngle, SHADOW, snapAngle, type TextBox, type TextLayout } from '../../core/text';
import type { Sheet } from '../../core/types';

/** Movement (px) below which a press counts as a tap. */
const TAP_SLOP = 4;

type Patch = Partial<Omit<TextBox, 'id'>>;

const boxStyle = (l: TextLayout, rotation: number, scale: number): CSSProperties => ({
  left: (l.cx - l.w / 2) * scale,
  top: (l.cy - l.h / 2) * scale,
  width: l.w * scale,
  height: l.h * scale,
  transform: rotation ? `rotate(${rotation}deg)` : undefined,
});

interface TextItemProps {
  box: TextBox;
  layout: TextLayout;
  /** False for an empty caption – shown faintly, not exported. */
  filled: boolean;
  sheet: Pick<Sheet, 'widthMm' | 'heightMm'>;
  scale: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Patch, transient: boolean) => void;
  onEnd: () => void;
  /** Double click / double tap – edit the text. */
  onEdit: (id: string) => void;
}

/** One caption on the sheet; every position comes from layoutText(), like in the exported file. */
export function TextItem({ box, layout: l, filled, sheet, scale, selected, onSelect, onChange, onEnd, onEdit }: TextItemProps) {
  const drag = useRef<{ id: number; x: number; y: number; moved: number; start: TextBox; lastTap: number } | null>(null);
  const lastTap = useRef(0);
  const f = fontInfo(box.font);
  const shadow = box.shadow ? `${SHADOW.offset}em ${SHADOW.offset}em ${SHADOW.blur}em ${SHADOW.color}` : undefined;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect(box.id);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, start: box, lastTap: lastTap.current };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
    if (d.moved <= TAP_SLOP) return;
    onChange(box.id, moveText(d.start, dx / scale, dy / scale, sheet), true);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved > TAP_SLOP) {
      onEnd();
      return;
    }
    // A second tap soon after the first one edits the text (dblclick does not fire for touch everywhere).
    const now = e.timeStamp;
    if (now - d.lastTap < 400) onEdit(box.id);
    lastTap.current = now;
  };

  return (
    <div
      data-testid="text-box"
      data-text-id={box.id}
      data-selected={selected || undefined}
      className="pointer-events-auto absolute cursor-move touch-none select-none"
      style={{ ...boxStyle(l, box.rotation, scale), opacity: filled ? 1 : 0.45 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* A bigger target than the letters – small captions are easy to grab. */}
      <div className="absolute -inset-2" />
      {l.lines.map((line, i) => (
        <div
          key={i}
          className="pointer-events-none absolute whitespace-pre"
          style={{
            left: line.x * scale,
            top: line.top * scale,
            height: l.lineHeight * scale,
            fontFamily: `"${f.family}", ${f.fallback}`,
            fontSize: box.sizeMm * scale,
            fontWeight: box.bold ? 700 : 400,
            fontStyle: box.italic ? 'italic' : 'normal',
            lineHeight: `${l.lineHeight * scale}px`,
            color: box.color,
            textShadow: shadow,
            fontKerning: 'normal',
          }}
        >
          {line.text}
        </div>
      ))}
      {box.underline &&
        l.lines.map(
          (line, i) =>
            line.text && (
              <div
                key={`u${i}`}
                className="pointer-events-none absolute"
                style={{
                  left: line.x * scale,
                  top: (line.baseline + l.underline.offset) * scale,
                  width: line.width * scale,
                  height: l.underline.thickness * scale,
                  backgroundColor: box.color,
                  boxShadow: box.shadow
                    ? `${SHADOW.offset * box.sizeMm * scale}px ${SHADOW.offset * box.sizeMm * scale}px ${SHADOW.blur * box.sizeMm * scale}px ${SHADOW.color}`
                    : undefined,
                }}
              />
            ),
        )}
    </div>
  );
}

interface FrameProps {
  box: TextBox;
  layout: TextLayout;
  scale: number;
  onChange: (id: string, patch: Patch, transient: boolean) => void;
  onEnd: () => void;
}

/**
 * Frame of the selected caption with its handles: size (corner) and rotation
 * (top). Outside the sheet's clipping, so the handles stay reachable at the edges.
 */
export function TextFrame({ box, layout: l, scale, onChange, onEnd }: FrameProps) {
  const frame = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; kind: 'size' | 'rotate'; cx: number; cy: number; dist: number; angle: number; start: TextBox } | null>(null);

  const start = (kind: 'size' | 'rotate') => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !frame.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // The centre of the bounding box is the caption's centre, whatever the rotation.
    const r = frame.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    gesture.current = {
      id: e.pointerId,
      kind,
      cx,
      cy,
      dist: Math.max(1, Math.hypot(e.clientX - cx, e.clientY - cy)),
      angle: Math.atan2(e.clientY - cy, e.clientX - cx),
      start: box,
    };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.kind === 'size') {
      const dist = Math.hypot(e.clientX - g.cx, e.clientY - g.cy);
      onChange(box.id, { sizeMm: (g.start.sizeMm * dist) / g.dist }, true);
    } else {
      const angle = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
      onChange(box.id, { rotation: snapAngle(normalizeAngle(g.start.rotation + ((angle - g.angle) * 180) / Math.PI)) }, true);
    }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture.current?.id !== e.pointerId) return;
    gesture.current = null;
    onEnd();
  };
  const handle = { onPointerMove: move, onPointerUp: up, onPointerCancel: up };

  return (
    <div ref={frame} className="pointer-events-none absolute z-30" style={boxStyle(l, box.rotation, scale)} data-testid="text-frame">
      <div className="absolute -inset-2 rounded-sm border-2 border-dashed border-brand shadow-[0_0_0_1px_rgba(255,255,255,0.8)]" />
      <div
        className="pointer-events-auto absolute -right-4 -bottom-4 h-5 w-5 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-brand shadow"
        title="Przeciągnij, aby zmienić rozmiar"
        data-testid="text-resize"
        onPointerDown={start('size')}
        {...handle}
      />
      <div className="absolute -top-8 left-1/2 h-6 w-0.5 -translate-x-1/2 bg-brand" />
      <div
        className="pointer-events-auto absolute -top-12 left-1/2 flex h-6 w-6 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow"
        title="Przeciągnij, aby obrócić"
        data-testid="text-rotate"
        onPointerDown={start('rotate')}
        {...handle}
      >
        <RotateCw className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
