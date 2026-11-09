import { FileImage, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  /** The image export is possible (there are photos on the sheet). */
  canExport: boolean;
  /** E.g. "JPG · 300 DPI" – the current export settings. */
  imageLabel: string;
  busy: boolean;
  onSaveProject: () => void;
  onSaveImage: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

const option =
  'flex w-full items-center gap-3 rounded-lg border border-slate-300 px-4 py-3 text-left transition-colors hover:border-brand hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:bg-transparent';
const secondary = 'rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40';

/** "New project": asks whether to keep the current work first, and how. */
export function NewProjectDialog({ canExport, imageLabel, busy, onSaveProject, onSaveImage, onDiscard, onCancel }: Props) {
  const [step, setStep] = useState<'ask' | 'how'>('ask');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onCancel()} data-testid="new-project-dialog">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onCancel} disabled={busy} className="absolute right-3 top-3 rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Anuluj">
          <X className="h-5 w-5" />
        </button>
        <h2 id="new-project-title" className="pr-8 text-lg font-bold text-slate-900">
          Nowy projekt
        </h2>

        {step === 'ask' ? (
          <>
            <p className="mt-2 text-sm text-slate-600">Czy zapisać obecny projekt przed rozpoczęciem nowego?</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={() => setStep('how')} className="rounded-lg bg-brand py-2.5 font-bold text-white hover:bg-blue-900" data-testid="new-save-yes">
                Tak, zapisz
              </button>
              <button type="button" onClick={onDiscard} className="rounded-lg border border-slate-300 py-2.5 font-bold text-slate-700 hover:bg-slate-50" data-testid="new-save-no">
                Nie zapisuj
              </button>
              <button type="button" onClick={onCancel} className={secondary} data-testid="new-cancel">
                Anuluj
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">Jak zapisać obecny projekt?</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={onSaveProject} disabled={busy} className={option} data-testid="new-save-project">
                <Save className="h-5 w-5 shrink-0 text-brand" />
                <span>
                  <span className="block text-sm font-bold text-slate-900">Jako projekt (.mosaic)</span>
                  <span className="block text-[11px] text-slate-500">Do dalszej edycji – zdjęcia, układ i ustawienia</span>
                </span>
              </button>
              <button type="button" onClick={onSaveImage} disabled={busy || !canExport} className={option} data-testid="new-save-image">
                <FileImage className="h-5 w-5 shrink-0 text-brand" />
                <span>
                  <span className="block text-sm font-bold text-slate-900">{busy ? 'Generowanie obrazu...' : 'Jako obraz'}</span>
                  <span className="block text-[11px] text-slate-500">{canExport ? `Gotowy kolaż do druku – ${imageLabel}` : 'Brak zdjęć na arkuszu'}</span>
                </span>
              </button>
              <button type="button" onClick={() => setStep('ask')} disabled={busy} className={secondary}>
                Wstecz
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
