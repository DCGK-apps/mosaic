import { Download, FolderOpen, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DPI_OPTIONS, exportExt, type ExportType } from '../core/export';
import { cleanName } from '../core/filename';
import { seriesFileBase } from '../core/batch';
import type { Doc } from '../core/types';
import { canPickFolder, existingNames, pickFolder, saveSeries, seriesNames, type DirHandle } from '../autoCollage';
import { collagesWord } from '../plural';
import { loadPref, savePref } from '../prefs';
import { toast } from '../toast';
import { cx } from './cx';

interface Props {
  docs: Doc[];
  urlOf: (photoId: string) => string | undefined;
  dpi: number;
  type: ExportType;
  onDpi: (dpi: number) => void;
  onType: (type: ExportType) => void;
  onClose: () => void;
}


/** "Zapisz wszystkie": every collage of the series as name_001, name_002… in a chosen folder (or one ZIP). */
export function SeriesSaveDialog({ docs, urlOf, dpi, type, onDpi, onType, onClose }: Props) {
  const [value, setValue] = useState(() => loadPref('lastSeriesName', 'kolaz'));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [overwrite, setOverwrite] = useState<{ dir: DirHandle; names: string[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const ext = exportExt(type);
  const base = cleanName(value, ext).replace(/_\d{3,}$/, '');
  const folder = canPickFolder();
  const busy = progress !== null;
  const count = docs.length;

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const run = async (dir: DirHandle | null) => {
    setOverwrite(null);
    setProgress({ done: 0, total: count });
    try {
      await saveSeries(docs, urlOf, dpi, type, base, dir, (done, total) => setProgress({ done, total }));
      savePref('lastSeriesName', base);
      toast(dir ? `Zapisano ${count} ${collagesWord(count)} w folderze ${dir.name}` : `Zapisano ${count} ${collagesWord(count)} (ZIP)`);
      onClose();
    } catch {
      setProgress(null);
      toast('Nie udało się zapisać kolaży');
    }
  };

  const start = async () => {
    if (!base) return;
    if (!folder) return run(null);
    let dir: DirHandle | null;
    try {
      dir = await pickFolder();
    } catch {
      toast('Nie udało się otworzyć folderu');
      return;
    }
    if (!dir) return;
    const taken = await existingNames(dir, seriesNames(base, count, type));
    if (taken.length) setOverwrite({ dir, names: taken });
    else await run(dir);
  };

  const names = seriesNames(base || 'kolaz', count, type);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()} data-testid="series-save-dialog">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="series-save-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !overwrite) void start();
        }}
      >
        <button type="button" onClick={onClose} disabled={busy} className="absolute right-3 top-3 rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Anuluj">
          <X className="h-5 w-5" />
        </button>
        <h2 id="series-save-title" className="pr-8 text-lg font-bold text-slate-900">
          Zapisz wszystkie kolaże ({count})
        </h2>

        <fieldset disabled={busy} className="mt-3 space-y-4">
          <div>
            <label className="block text-sm text-slate-600" htmlFor="series-name">
              Nazwa plików
            </label>
            <div className="mt-1 flex items-center rounded-lg border border-slate-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <input
                ref={input}
                id="series-name"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 text-base outline-none"
                data-testid="series-name"
              />
              <span className="pr-3 text-sm text-slate-500">_000{ext}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500" data-testid="series-names">
              {names[0]}
              {count > 1 && ` … ${names[count - 1]}`}
            </p>
          </div>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Jakość</span>
              <select
                value={dpi}
                onChange={(e) => onDpi(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm font-medium focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                data-testid="series-dpi"
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
                    onClick={() => onType(t)}
                    className={cx('flex-1 rounded-md py-1 text-xs font-bold transition-all', type === t ? 'bg-white text-brand shadow' : 'text-slate-500')}
                  >
                    {t === 'jpeg' ? 'JPG' : 'PNG'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!folder && (
            <p className="text-xs text-slate-500">
              Ta przeglądarka nie pozwala zapisać plików w wybranym folderze – kolaże zostaną spakowane do jednego pliku <b>{base || 'kolaz'}.zip</b>. Wybór folderu działa w Chrome i Edge.
            </p>
          )}
        </fieldset>

        {overwrite && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="series-overwrite">
            W folderze <b>{overwrite.dir.name}</b> są już pliki o tych nazwach ({overwrite.names.length}, np. {overwrite.names[0]}). Zastąpić je?
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setOverwrite(null)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-white">
                Anuluj
              </button>
              <button type="button" onClick={() => void run(overwrite.dir)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-700" data-testid="series-overwrite-yes">
                Zastąp
              </button>
            </div>
          </div>
        )}

        {progress ? (
          <div className="mt-5" data-testid="series-progress">
            <div className="mb-1 text-xs text-slate-600">
              Zapisywanie {Math.min(progress.done + 1, progress.total)} / {progress.total} ({seriesFileBase(base, Math.min(progress.done + 1, progress.total))}
              {ext})
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-brand transition-[width]" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
          </div>
        ) : (
          !overwrite && (
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
                Anuluj
              </button>
              <button
                type="submit"
                disabled={!base || count === 0}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-40"
                data-testid="series-save"
              >
                {folder ? <FolderOpen className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {folder ? 'Wybierz folder i zapisz' : 'Zapisz jako ZIP'}
              </button>
            </div>
          )
        )}
      </form>
    </div>
  );
}
