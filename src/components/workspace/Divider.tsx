import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Junction } from '../../core/edges';
import type { DividerBox } from '../../core/geometry';
import { cx } from '../cx';
import { HIT_PX } from './useEdgeDrag';

/** Grab area of a crossing knob in screen pixels. */
const KNOB_PX = 24;

interface Props {
  divider: DividerBox;
  /** Screen pixels per millimetre. */
  scale: number;
  /** Being dragged – the handle stays visible. */
  active: boolean;
  /** The drag itself is handled by useEdgeDrag. */
  onGrab: (splitId: string, e: ReactPointerEvent) => void;
}

export function Divider({ divider: d, scale, active, onGrab }: Props) {
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
      data-active={active || undefined}
      style={style}
      className={cx('group absolute z-10 flex touch-none items-center justify-center', vertical ? 'cursor-col-resize' : 'cursor-row-resize')}
      onPointerDown={(e) => onGrab(d.splitId, e)}
    >
      <div
        className={cx(
          'rounded-full bg-blue-900 transition-opacity group-hover:opacity-100',
          active ? 'opacity-100' : 'opacity-0',
          vertical ? 'h-12 w-1.5' : 'h-1.5 w-12',
        )}
      />
    </div>
  );
}

interface JunctionProps {
  junction: Junction;
  scale: number;
  active: boolean;
  onGrab: (j: Junction, e: ReactPointerEvent) => void;
}

/** Knob on a crossing: grabbed here, the whole line moves (the direction of the drag picks which one). */
export function JunctionKnob({ junction: j, scale, active, onGrab }: JunctionProps) {
  const size = Math.max(KNOB_PX, Math.max(j.w, j.h) * scale + 6);
  return (
    <div
      data-testid="junction"
      title="Przesuń całą linię"
      style={{ left: (j.x + j.w / 2) * scale - size / 2, top: (j.y + j.h / 2) * scale - size / 2, width: size, height: size }}
      className="group absolute z-[15] flex cursor-move touch-none items-center justify-center"
      onPointerDown={(e) => onGrab(j, e)}
    >
      <div
        className={cx(
          'h-3 w-3 rounded-full border-2 border-blue-900 bg-white shadow transition-opacity group-hover:opacity-100',
          active ? 'opacity-100' : 'opacity-70',
        )}
      />
    </div>
  );
}
