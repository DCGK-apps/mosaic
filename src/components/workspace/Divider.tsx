import type { PointerEvent as ReactPointerEvent } from 'react';
import type { DividerBox } from '../../core/geometry';
import { cx } from '../cx';
import { HIT_PX } from './useEdgeDrag';

interface Props {
  divider: DividerBox;
  /** Screen pixels per millimetre. */
  scale: number;
  /** Being dragged – the handle stays visible. */
  active: boolean;
  /** The drag itself is handled by useEdgeDrag (it may pick another edge at a crossing). */
  onGrab: (e: ReactPointerEvent) => void;
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
      onPointerDown={onGrab}
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
