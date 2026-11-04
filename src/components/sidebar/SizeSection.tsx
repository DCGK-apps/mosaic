import { RefreshCw } from 'lucide-react';
import { applyFormat, FORMATS, matchFormat } from '../../core/formats';
import type { Sheet } from '../../core/types';
import { NumberField } from './NumberField';
import { SectionTitle } from './ui';

interface Props {
  sheet: Sheet;
  onSheet: (patch: Partial<Sheet>) => void;
  onRotate: () => void;
}

export function SizeSection({ sheet, onSheet, onRotate }: Props) {
  const format = matchFormat(sheet.widthMm, sheet.heightMm);
  return (
    <div>
      <SectionTitle className="mb-3">Wymiary i Wygląd</SectionTitle>
      <label className="mb-3 block">
        <span className="mb-1 block text-[10px] font-bold text-slate-500">Format</span>
        <select
          value={format?.id ?? 'custom'}
          data-testid="format"
          onChange={(e) => {
            const f = FORMATS.find((x) => x.id === e.target.value);
            if (f) onSheet(applyFormat(f, sheet));
          }}
          className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm font-medium focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="custom">Własny</option>
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <NumberField label="Szerokość (mm)" value={sheet.widthMm} onCommit={(widthMm) => onSheet({ widthMm })} testId="width" />
        <NumberField label="Wysokość (mm)" value={sheet.heightMm} onCommit={(heightMm) => onSheet({ heightMm })} testId="height" />
      </div>
      <button
        type="button"
        onClick={onRotate}
        data-testid="rotate"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-brand hover:bg-slate-50 hover:text-brand"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Zamień (Pion / Poziom)
      </button>
    </div>
  );
}
