import { FolderOpen, LayoutDashboard, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clampRange, collageCount, inChosenFolder, MAX_BATCH_PHOTOS, MAX_PER_COLLAGE, type BatchOrder } from '../core/batch';
import { docReducer, emptyDoc } from '../core/doc';
import type { LayoutMode, Sheet } from '../core/types';
import { Cancelled, createSeries, folderName, pathOf, photoFiles, type Progress, type SeriesResult } from '../autoCollage';
import { collagesWord, photosWord } from '../plural';
import { loadPref, savePref } from '../prefs';
import { cx } from './cx';
import { MODES } from './sidebar/LayoutSection';
import { SizeSection } from './sidebar/SizeSection';
import { StyleSection } from './sidebar/StyleSection';
import { SectionTitle } from './sidebar/ui';

interface Props {
  /** Starting values: the current sheet and layout. */
  sheet: Sheet;
  mode: LayoutMode;
  /** Collages in the current series – it will be replaced. */
  existing: number;
  onDone: (result: SeriesResult) => void;
  onCancel: () => void;
}

const field = 'w-16 rounded-md border border-slate-300 bg-white p-2 text-center text-sm font-medium focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';


/** Sheet changes go through the reducer, so the limits (sizes, frame) are the same as in the editor. */
const patchSheet = (sheet: Sheet, patch: Partial<Sheet>) => docReducer({ ...emptyDoc(), sheet }, { type: 'setSheet', patch }).sheet;

/** "Kolaże z folderu": the user picks a folder and the rules, the app makes the whole series. */
export function AutoCollageDialog({ sheet: initialSheet, mode: initialMode, existing, onDone, onCancel }: Props) {
  /** Photos in the chosen folder and in the folders inside it. */
  const [allFiles, setAllFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState('');
  const [subfolders, setSubfolders] = useState(() => loadPref<unknown>('autoSubfolders', false) === true);
  const files = subfolders ? allFiles : allFiles.filter((f) => inChosenFolder(pathOf(f)));
  const nested = allFiles.length - allFiles.filter((f) => inChosenFolder(pathOf(f))).length;
  const [min, setMin] = useState(() => loadPref('autoMin', 3));
  const [max, setMax] = useState(() => loadPref('autoMax', 6));
  const [order, setOrder] = useState<BatchOrder>(() => (loadPref<string>('autoOrder', 'date') === 'name' ? 'name' : 'date'));
  const [mode, setMode] = useState<LayoutMode>(initialMode);
  const [sheet, setSheet] = useState<Sheet>(initialSheet);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const cancelled = useRef(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const busy = progress !== null;

  const range = clampRange(min, max);
  const used = Math.min(files.length, MAX_BATCH_PHOTOS);
  const count = collageCount(used, range.min, range.max);

  useEffect(() => {
    // `webkitdirectory` is not in React's attribute list.
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (busy) cancelled.current = true;
      else onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const start = async () => {
    savePref('autoMin', range.min);
    savePref('autoMax', range.max);
    savePref('autoOrder', order);
    savePref('autoSubfolders', subfolders);
    setMin(range.min);
    setMax(range.max);
    setError('');
    cancelled.current = false;
    setProgress({ stage: 'read', done: 0, total: used });
    try {
      const result = await createSeries(files, order, { min: range.min, max: range.max, mode, sheet }, setProgress, () => cancelled.current);
      if (result.docs.length === 0) {
        setError('Nie udało się wczytać żadnego zdjęcia z tego folderu');
        setProgress(null);
        return;
      }
      onDone(result);
    } catch (e) {
      setProgress(null);
      if (!(e instanceof Cancelled)) setError('Nie udało się utworzyć kolaży');
    }
  };

  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onCancel()} data-testid="auto-dialog">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-title"
        className="relative flex max-h-full w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onCancel} disabled={busy} className="absolute right-3 top-3 rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Anuluj">
          <X className="h-5 w-5" />
        </button>
        <div className="border-b border-slate-200 p-5 pb-4">
          <h2 id="auto-title" className="flex items-center gap-2 pr-8 text-lg font-bold text-slate-900">
            <LayoutDashboard className="h-5 w-5 text-brand" /> Kolaże z folderu
          </h2>
          <p className="mt-1 text-sm text-slate-600">Program podzieli wszystkie zdjęcia z folderu na kolejne kolaże. Zdjęcia nie są nigdzie wysyłane – zostają na tym komputerze.</p>
        </div>

        <fieldset disabled={busy} className="custom-scrollbar grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 md:grid-cols-2">
          <div className="space-y-5">
            <div>
              <SectionTitle>Folder ze zdjęciami</SectionTitle>
              <button
                type="button"
                onClick={() => folderInput.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-bold text-slate-600 transition-colors hover:border-brand hover:bg-slate-50 hover:text-brand"
                data-testid="auto-pick-folder"
              >
                <FolderOpen className="h-5 w-5" /> {folder ? 'Zmień folder…' : 'Wybierz folder…'}
              </button>
              <input
                ref={folderInput}
                type="file"
                multiple
                hidden
                data-testid="auto-folder-input"
                onChange={(e) => {
                  const all = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  if (!all.length) return;
                  setAllFiles(photoFiles(all));
                  setFolder(folderName(all));
                  setError('');
                }}
              />
              {folder && (
                <p className="mt-2 text-sm text-slate-700" data-testid="auto-folder-info">
                  <b>{folder}</b>: {files.length} {photosWord(files.length)}
                  {!subfolders && nested > 0 && <span className="text-slate-500"> (+{nested} w podfolderach)</span>}
                  {files.length === 0 && ' – brak zdjęć (JPG, PNG, WebP)'}
                </p>
              )}
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={subfolders}
                  onChange={(e) => setSubfolders(e.target.checked)}
                  className="h-4 w-4 accent-brand"
                  data-testid="auto-subfolders"
                />
                Uwzględnij zdjęcia z podfolderów
              </label>
              {files.length > MAX_BATCH_PHOTOS && (
                <p className="mt-1 text-xs text-amber-700" data-testid="auto-limit">
                  Jednorazowo można użyć do {MAX_BATCH_PHOTOS} zdjęć – zostanie wziętych pierwszych {MAX_BATCH_PHOTOS} (w wybranej kolejności).
                </p>
              )}
            </div>

            <div>
              <SectionTitle>Liczba zdjęć w kolażu</SectionTitle>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                od
                <input
                  type="number"
                  min={1}
                  max={MAX_PER_COLLAGE}
                  value={min}
                  onChange={(e) => setMin(Number(e.target.value))}
                  onBlur={() => setMin(clampRange(min, MAX_PER_COLLAGE).min)}
                  className={field}
                  data-testid="auto-min"
                />
                do
                <input
                  type="number"
                  min={1}
                  max={MAX_PER_COLLAGE}
                  value={max}
                  onChange={(e) => setMax(Number(e.target.value))}
                  onBlur={() => setMax(clampRange(1, max).max)}
                  className={field}
                  data-testid="auto-max"
                />
              </div>
              {used > 0 && (
                <p className="mt-2 text-xs text-slate-500" data-testid="auto-estimate">
                  {count
                    ? count.lo === count.hi
                      ? `Powstanie ${count.lo} ${collagesWord(count.lo)}.`
                      : `Powstanie od ${count.lo} do ${count.hi} kolaży – program wybierze podział, w którym zdjęcia najlepiej pasują do układu.`
                    : `${used} ${photosWord(used)} nie da się podzielić dokładnie po ${range.min === range.max ? range.min : `${range.min}–${range.max}`} – jeden kolaż będzie miał inną liczbę zdjęć.`}
                </p>
              )}
            </div>

            <div>
              <SectionTitle>Kolejność zdjęć</SectionTitle>
              <div className="flex rounded-lg bg-slate-200 p-1" role="radiogroup" aria-label="Kolejność zdjęć">
                {(
                  [
                    ['date', 'Data wykonania'],
                    ['name', 'Nazwa pliku'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={order === id}
                    onClick={() => setOrder(id)}
                    data-testid={`auto-order-${id}`}
                    className={cx('flex-1 rounded-md py-1.5 text-xs font-medium transition-all', order === id ? 'bg-white text-brand shadow' : 'text-slate-500 hover:text-slate-700')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {order === 'date' ? 'Data zrobienia zdjęcia z aparatu (EXIF), a gdy jej brak – data zmiany pliku.' : 'Jak w Eksploratorze plików: IMG_2 przed IMG_10.'}
              </p>
            </div>

            <div>
              <SectionTitle>Podział strony</SectionTitle>
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Podział strony">
                {MODES.map(({ mode: m, label, Icon }) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    data-testid={`auto-mode-${m}`}
                    onClick={() => setMode(m)}
                    className={cx(
                      'flex flex-col items-center justify-center gap-1 rounded border py-2 transition-colors',
                      mode === m ? 'border-brand bg-blue-50 text-brand shadow-inner' : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[9px] font-bold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <SizeSection sheet={sheet} onSheet={(patch) => setSheet((s) => patchSheet(s, patch))} onRotate={() => setSheet((s) => ({ ...s, widthMm: s.heightMm, heightMm: s.widthMm }))} />
            <StyleSection sheet={sheet} onSheet={(patch) => setSheet((s) => patchSheet(s, patch))} onEnd={() => undefined} />
          </div>
        </fieldset>

        <div className="border-t border-slate-200 p-5 pt-4">
          {error && (
            <p className="mb-3 text-sm text-red-600" data-testid="auto-error">
              {error}
            </p>
          )}
          {progress ? (
            <div data-testid="auto-progress">
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>{progress.stage === 'read' ? `Wczytywanie zdjęć ${progress.done} / ${progress.total}` : 'Dobieranie liczby zdjęć i układów…'}</span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => (cancelled.current = true)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100" data-testid="auto-stop">
                  Przerwij
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              {existing > 0 && <span className="mr-auto text-xs text-amber-700">Obecna seria ({existing}) zostanie zastąpiona.</span>}
              <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100" data-testid="auto-cancel">
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => void start()}
                disabled={used === 0}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-40"
                data-testid="auto-create"
              >
                <LayoutDashboard className="h-4 w-4" /> Utwórz kolaże
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
