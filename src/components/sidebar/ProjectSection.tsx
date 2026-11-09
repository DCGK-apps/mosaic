import { FilePlus, FolderOpen, Save } from 'lucide-react';
import { SectionTitle } from './ui';

interface Props {
  /** Nothing to save yet (no photos on the sheet or in the magazine). */
  empty: boolean;
  onSave: () => void;
  onOpen: () => void;
  onNew: () => void;
}

const button =
  'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand px-2 py-2 text-xs font-bold text-brand transition-colors hover:bg-brand/5 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent';

/** Editable project file: save the work and come back to it later. */
export function ProjectSection({ empty, onSave, onOpen, onNew }: Props) {
  return (
    <div>
      <SectionTitle>Projekt do dalszej edycji</SectionTitle>
      <div className="flex gap-3">
        <button type="button" onClick={onSave} disabled={empty} className={button} data-testid="project-save">
          <Save className="h-4 w-4" /> Zapisz projekt
        </button>
        <button type="button" onClick={onOpen} className={button} data-testid="project-open">
          <FolderOpen className="h-4 w-4" /> Otwórz projekt
        </button>
      </div>
      <button type="button" onClick={onNew} disabled={empty} className={`${button} mt-3 w-full`} data-testid="project-new">
        <FilePlus className="h-4 w-4" /> Nowy projekt
      </button>
      <p className="mt-2 text-[11px] text-slate-500">Plik .mosaic zawiera zdjęcia, układ, kadry i ustawienia – po otwarciu można dalej edytować kolaż.</p>
    </div>
  );
}
