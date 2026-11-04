import { DEFAULT_SHEET, MAX_GAP_MM, MAX_RADIUS_MM } from '../../core/doc';
import type { Sheet } from '../../core/types';

interface Props {
  sheet: Sheet;
  /** `transient` while a slider or colour picker is being dragged. */
  onSheet: (patch: Partial<Sheet>, transient?: boolean) => void;
  onEnd: () => void;
}

const fmt = (mm: number) => `${String(mm).replace('.', ',')} mm`;

export function StyleSection({ sheet, onSheet, onEnd }: Props) {
  const endProps = { onPointerUp: onEnd, onKeyUp: onEnd, onBlur: onEnd };
  return (
    <>
      <div className="pt-2">
        <label className="block">
          <span className="mb-1 flex justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Grubość ramki</span>
            <span className="text-xs font-bold text-brand">{fmt(sheet.gapMm)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={MAX_GAP_MM}
            step={0.5}
            value={sheet.gapMm}
            data-testid="gap"
            onChange={(e) => onSheet({ gapMm: Number(e.target.value) }, true)}
            {...endProps}
            className="w-full accent-brand"
          />
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <div className="flex-1">
          <div className="mb-1 flex justify-between">
            <label htmlFor="frame-color" className="text-[10px] font-bold uppercase text-slate-500">
              Kolor ramki
            </label>
            <button
              type="button"
              onClick={() => onSheet({ frameColor: DEFAULT_SHEET.frameColor })}
              className="text-[9px] font-bold text-slate-400 hover:text-brand"
              title="Przywróć domyślny biały"
            >
              DOMYŚLNY
            </button>
          </div>
          <input
            id="frame-color"
            type="color"
            value={sheet.frameColor}
            data-testid="frame-color"
            onChange={(e) => onSheet({ frameColor: e.target.value }, true)}
            onBlur={onEnd}
            className="h-8 w-full cursor-pointer rounded border-0 p-0"
          />
        </div>
        <label className="block flex-1">
          <span className="mb-1 flex justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Zaokrąglenie</span>
            <span className="text-xs font-bold text-brand">{fmt(sheet.radiusMm)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={MAX_RADIUS_MM}
            step={0.5}
            value={sheet.radiusMm}
            data-testid="radius"
            onChange={(e) => onSheet({ radiusMm: Number(e.target.value) }, true)}
            {...endProps}
            className="w-full accent-brand"
          />
        </label>
      </div>
    </>
  );
}
