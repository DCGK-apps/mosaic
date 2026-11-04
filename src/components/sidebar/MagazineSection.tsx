import { Plus, Trash2 } from 'lucide-react';
import type { Photo } from '../../core/types';

interface Props {
  photos: Photo[];
  urlOf: (id: string) => string | undefined;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MagazineSection({ photos, urlOf, onRestore, onDelete }: Props) {
  if (photos.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-inner" data-testid="magazine">
      <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">Magazyn odłożonych ({photos.length})</h3>
      <div className="custom-scrollbar flex snap-x gap-2 overflow-x-auto pb-2">
        {photos.map((p) => (
          <div key={p.id} className="group relative h-12 w-12 shrink-0 snap-start overflow-hidden rounded border border-slate-300" data-testid="magazine-item">
            <img src={urlOf(p.id)} alt={p.name} className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" draggable={false} />
            <div className="absolute inset-0 flex flex-col bg-black/70 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:bg-black/40 [@media(hover:none)]:opacity-100">
              <button
                type="button"
                onClick={() => onRestore(p.id)}
                className="flex flex-1 items-center justify-center text-white hover:bg-brand"
                title="Przywróć do kolażu"
                aria-label="Przywróć do kolażu"
                data-testid="magazine-restore"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                className="flex flex-1 items-center justify-center text-white hover:bg-red-600"
                title="Usuń trwale"
                aria-label="Usuń trwale"
                data-testid="magazine-delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
