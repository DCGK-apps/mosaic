import { Download, RefreshCw } from 'lucide-react';
import { DPI_OPTIONS, exportSize, type ExportType } from '../../core/export';
import type { Sheet } from '../../core/types';
import { maxPixels } from '../../exporter';
import { cx } from '../cx';

interface Props {
  sheet: Sheet;
  disabled: boolean;
  exporting: boolean;
  dpi: number;
  type: ExportType;
  onDpi: (dpi: number) => void;
  onType: (type: ExportType) => void;
  onExport: () => void;
}

export function ExportSection({ sheet, disabled, exporting, dpi, type, onDpi, onType, onExport }: Props) {
  const size = exportSize(sheet, dpi, maxPixels());
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <label className="block flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Jakość</span>
          <select
            value={dpi}
            data-testid="dpi"
            onChange={(e) => onDpi(Number(e.target.value))}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm font-medium focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {DPI_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} DPI
              </option>
            ))}
          </select>
        </label>
        <div className="flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Plik</span>
          <div className="flex rounded-lg bg-slate-200 p-1" role="radiogroup" aria-label="Typ pliku">
            {(['jpeg', 'png'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                data-testid={`type-${t}`}
                onClick={() => onType(t)}
                className={cx('flex-1 rounded-md py-1 text-xs font-bold transition-all', type === t ? 'bg-white text-brand shadow' : 'text-slate-500')}
              >
                {t === 'jpeg' ? 'JPG' : 'PNG'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500" data-testid="export-size">
        {size.width} × {size.height} px
        {size.reduced && ' – zmniejszone do limitu przeglądarki'}
      </p>
      <button
        type="button"
        onClick={onExport}
        disabled={disabled || exporting}
        data-testid="export"
        className={cx(
          'flex w-full items-center justify-center gap-2 rounded-lg py-3 font-bold shadow-md transition-all',
          disabled ? 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none' : 'bg-black text-white hover:bg-slate-800',
        )}
      >
        {exporting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
        {exporting ? 'Generowanie obrazu...' : 'Zapisz Kolaż na Dysku'}
      </button>
    </div>
  );
}
