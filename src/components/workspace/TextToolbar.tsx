import { AlignCenter, AlignLeft, AlignRight, Bold, Check, Italic, Minus, Plus, RotateCcw, Trash2, Underline } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { clampTextSize, FONTS, fontInfo, NEW_TEXT, type TextAlign, type TextBox } from '../../core/text';
import { cx } from '../cx';

type Patch = Partial<Omit<TextBox, 'id'>>;

interface Props {
  box: TextBox;
  /** `transient` while typing or dragging a picker – one undo step per edit. */
  onChange: (patch: Patch, transient?: boolean) => void;
  onEnd: () => void;
  onDelete: () => void;
  onDone: () => void;
  /** Changes when the text field should get the focus (new caption, double click). */
  focusKey: number;
}

const ALIGN_NEXT: Record<TextAlign, TextAlign> = { left: 'center', center: 'right', right: 'left' };
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight };
const ALIGN_LABEL = { left: 'Do lewej', center: 'Do środka', right: 'Do prawej' };

function Toggle({ on, onClick, title, testId, children }: { on: boolean; onClick: () => void; title: string; testId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={on}
      data-testid={testId}
      className={cx('flex h-8 w-8 items-center justify-center rounded transition-colors', on ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100')}
    >
      {children}
    </button>
  );
}

/** Editing the selected caption: text, font, size, style, colour. */
export function TextToolbar({ box, onChange, onEnd, onDelete, onDone, focusKey }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const AlignIcon = ALIGN_ICON[box.align];

  useEffect(() => {
    if (!focusKey || !input.current) return;
    input.current.focus();
    input.current.select();
  }, [focusKey]);

  const size = (delta: number) => onChange({ sizeMm: clampTextSize(box.sizeMm + delta * Math.max(1, Math.round(box.sizeMm / 10))) });
  const rows = Math.min(4, Math.max(1, box.text.split('\n').length));

  return (
    <div
      className="z-30 mt-3 flex w-full max-w-3xl shrink-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
      data-testid="text-toolbar"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onDone();
        }
      }}
    >
      <textarea
        ref={input}
        value={box.text}
        rows={rows}
        placeholder={NEW_TEXT}
        aria-label="Treść napisu"
        data-testid="text-input"
        onChange={(e) => onChange({ text: e.target.value }, true)}
        onBlur={onEnd}
        className="w-full resize-none rounded-lg border border-slate-300 px-3 py-1.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        style={{ fontFamily: `"${fontInfo(box.font).family}", ${fontInfo(box.font).fallback}` }}
      />
      <div className="flex flex-wrap items-center gap-1">
        <select
          value={box.font}
          onChange={(e) => onChange({ font: e.target.value as TextBox['font'] })}
          aria-label="Czcionka"
          title="Czcionka"
          data-testid="text-font"
          className="h-8 max-w-[13rem] rounded border border-slate-300 bg-white px-1.5 text-sm"
          style={{ fontFamily: `"${fontInfo(box.font).family}", ${fontInfo(box.font).fallback}` }}
        >
          {FONTS.map((f) => (
            <option key={f.id} value={f.id} style={{ fontFamily: `"${f.family}", ${f.fallback}` }}>
              {f.label} · {f.kind}
            </option>
          ))}
        </select>

        <div className="flex items-center rounded border border-slate-300">
          <button type="button" onClick={() => size(-1)} className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-100" title="Mniejszy" aria-label="Mniejszy napis" data-testid="text-size-down">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3.5rem] text-center text-xs font-bold text-slate-700" data-testid="text-size" title="Wysokość czcionki na wydruku">
            {String(box.sizeMm).replace('.', ',')} mm
          </span>
          <button type="button" onClick={() => size(1)} className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-100" title="Większy" aria-label="Większy napis" data-testid="text-size-up">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <Toggle on={box.bold} onClick={() => onChange({ bold: !box.bold })} title="Pogrubienie" testId="text-bold">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle on={box.italic} onClick={() => onChange({ italic: !box.italic })} title="Kursywa" testId="text-italic">
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle on={box.underline} onClick={() => onChange({ underline: !box.underline })} title="Podkreślenie" testId="text-underline">
            <Underline className="h-4 w-4" />
          </Toggle>
          <Toggle on={false} onClick={() => onChange({ align: ALIGN_NEXT[box.align] })} title={`Wyrównanie: ${ALIGN_LABEL[box.align].toLowerCase()}`} testId="text-align">
            <AlignIcon className="h-4 w-4" />
          </Toggle>
          <Toggle on={box.shadow} onClick={() => onChange({ shadow: !box.shadow })} title="Cień" testId="text-shadow">
            <span className="text-sm font-black" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.6)' }}>
              S
            </span>
          </Toggle>
        </div>

        <input
          type="color"
          value={box.color}
          onChange={(e) => onChange({ color: e.target.value }, true)}
          onBlur={onEnd}
          title="Kolor napisu"
          aria-label="Kolor napisu"
          data-testid="text-color"
          className="h-8 w-9 cursor-pointer rounded border border-slate-300 p-0.5"
        />

        {box.rotation !== 0 && (
          <button
            type="button"
            onClick={() => onChange({ rotation: 0 })}
            className="flex h-8 items-center gap-1 rounded px-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
            title="Wyprostuj napis"
            data-testid="text-unrotate"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {String(box.rotation).replace('.', ',')}°
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600" title="Usuń napis" aria-label="Usuń napis" data-testid="text-delete">
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDone} className="flex h-8 items-center gap-1 rounded-lg bg-brand px-3 text-sm font-bold text-white hover:opacity-90" data-testid="text-done">
            <Check className="h-4 w-4" /> Gotowe
          </button>
        </div>
      </div>
    </div>
  );
}
