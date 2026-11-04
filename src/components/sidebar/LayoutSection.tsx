import {
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyStart,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Grid,
  LayoutGrid,
  Move,
  RefreshCw,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { LayoutMode } from '../../core/types';
import { cx } from '../cx';
import { SectionTitle } from './ui';

const MODES: { mode: LayoutMode; label: string; Icon: LucideIcon }[] = [
  { mode: 'auto', label: 'AUTO', Icon: Grid },
  { mode: 'grid', label: 'SIATKA', Icon: LayoutGrid },
  { mode: 'central', label: 'CENTRALNY', Icon: Target },
  { mode: 'rows', label: 'POZIOMO', Icon: AlignVerticalJustifyStart },
  { mode: 'cols', label: 'PIONOWO', Icon: AlignHorizontalJustifyStart },
];

interface Props {
  mode: LayoutMode;
  autoIndex: number;
  autoCount: number;
  swapMode: boolean;
  onMode: (mode: LayoutMode) => void;
  onAutoStep: (delta: number) => void;
  onShuffle: () => void;
  onSwapMode: (swap: boolean) => void;
}

export function LayoutSection({ mode, autoIndex, autoCount, swapMode, onMode, onAutoStep, onShuffle, onSwapMode }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Podział strony</SectionTitle>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Podział strony">
          {MODES.map(({ mode: m, label, Icon }) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              data-testid={`mode-${m}`}
              onClick={() => onMode(m)}
              className={cx(
                'flex flex-col items-center justify-center gap-1 rounded border py-2 transition-colors',
                mode === m ? 'border-brand bg-blue-50 text-brand shadow-inner' : 'border-slate-200 text-slate-500 hover:bg-slate-50',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>

        {mode === 'auto' && autoCount > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAutoStep(-1)}
                disabled={autoIndex === 0}
                aria-label="Poprzedni układ"
                data-testid="auto-prev"
                className="rounded p-1 text-slate-500 transition-colors hover:bg-blue-100 hover:text-brand disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[35px] text-center text-[10px] font-bold text-slate-500" data-testid="auto-position">
                {autoIndex + 1} / {autoCount}
              </span>
              <button
                type="button"
                onClick={() => onAutoStep(1)}
                disabled={autoIndex === autoCount - 1}
                aria-label="Następny układ"
                data-testid="auto-next"
                className="rounded p-1 text-slate-500 transition-colors hover:bg-blue-100 hover:text-brand disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={onShuffle}
              data-testid="shuffle"
              className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-blue-900"
            >
              <RefreshCw className="h-3 w-3" /> LOSUJ NOWY
            </button>
          </div>
        )}
      </div>

      <div>
        <SectionTitle>Akcja myszy / dotyku</SectionTitle>
        <div className="flex rounded-lg bg-slate-200 p-1" role="radiogroup" aria-label="Akcja myszy / dotyku">
          {[
            { swap: false, label: 'Przesuń kadr', Icon: Move, id: 'tool-crop' },
            { swap: true, label: 'Zamień miejscami', Icon: ArrowLeftRight, id: 'tool-swap' },
          ].map(({ swap, label, Icon, id }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={swapMode === swap}
              data-testid={id}
              onClick={() => onSwapMode(swap)}
              className={cx(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all',
                swapMode === swap ? 'bg-white text-brand shadow' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
