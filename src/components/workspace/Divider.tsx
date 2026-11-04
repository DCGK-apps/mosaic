import { useRef } from 'react';
import type { DividerBox } from '../../core/geometry';
import { cx } from '../cx';

/** Minimum grab area in screen pixels, also when the frame is thin or 0. */
const HIT_PX = 16;

interface Props {
  divider: DividerBox;
  /** Screen pixels per millimetre. */
  scale: number;
  onMove: (splitId: string, frac: number) => void;
  onEnd: () => void;
}

export function Divider({ divider: d, scale, onMove, onEnd }: Props) {
  const drag = useRef<{ start: number; frac: number } | null>(null);
  const vertical = d.dir === 'V';
  const thick = Math.max(HIT_PX, (vertical ? d.w : d.h) * scale);
  const style = vertical
    ? { left: (d.x + d.w / 2) * scale - thick / 2, top: d.y * scale, width: thick, height: d.h * scale }
    : { left: d.x * scale, top: (d.y + d.h / 2) * scale - thick / 2, width: d.w * scale, height: thick };

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(d.frac * 100)}
      data-testid="divider"
      data-split-id={d.splitId}
      data-dir={d.dir}
      style={style}
      className={cx('group absolute z-10 flex touch-none items-center justify-center', vertical ? 'cursor-col-resize' : 'cursor-row-resize')}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { start: vertical ? e.clientX : e.clientY, frac: d.frac };
      }}
      onPointerMove={(e) => {
        const g = drag.current;
        if (!g || d.available <= 0) return;
        const deltaMm = ((vertical ? e.clientX : e.clientY) - g.start) / scale;
        onMove(d.splitId, g.frac + deltaMm / d.available);
      }}
      onPointerUp={() => {
        drag.current = null;
        onEnd();
      }}
      onPointerCancel={() => {
        drag.current = null;
        onEnd();
      }}
    >
      <div className={cx('rounded-full bg-blue-900 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100', vertical ? 'h-12 w-1.5' : 'h-1.5 w-12')} />
    </div>
  );
}
