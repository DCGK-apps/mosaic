import { Save, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cleanName } from '../core/filename';

interface Props {
  title: string;
  /** Proposed name, without the extension. */
  initial: string;
  /** E.g. ".jpg" – shown after the field, added to the name. */
  ext: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

/** Asks for the file name before saving. */
export function FileNameDialog({ title, initial, ext, onSave, onCancel }: Props) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const name = cleanName(value, ext);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onCancel} data-testid="filename-dialog">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="filename-title"
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (name) onSave(name);
        }}
      >
        <button type="button" onClick={onCancel} className="absolute right-3 top-3 rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Anuluj">
          <X className="h-5 w-5" />
        </button>
        <h2 id="filename-title" className="pr-8 text-lg font-bold text-slate-900">
          {title}
        </h2>
        <label className="mt-3 block text-sm text-slate-600" htmlFor="filename-input">
          Nazwa pliku
        </label>
        <div className="mt-1 flex items-center rounded-lg border border-slate-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
          <input
            ref={input}
            id="filename-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 text-base outline-none"
            data-testid="filename-input"
          />
          <span className="pr-3 text-sm text-slate-500">{ext}</span>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100" data-testid="filename-cancel">
            Anuluj
          </button>
          <button
            type="submit"
            disabled={!name}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-40"
            data-testid="filename-save"
          >
            <Save className="h-4 w-4" /> Zapisz
          </button>
        </div>
      </form>
    </div>
  );
}
