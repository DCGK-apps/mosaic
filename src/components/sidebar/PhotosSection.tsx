import { Plus, Trash2, Upload } from 'lucide-react';
import type { Photo } from '../../core/types';
import { SectionTitle } from './ui';

interface Props {
  photos: Photo[];
  urlOf: (id: string) => string | undefined;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export function PhotosSection({ photos, urlOf, onAdd, onRemove }: Props) {
  return (
    <div>
      <button
        type="button"
        onClick={onAdd}
        data-testid="add-photos"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 font-medium text-white shadow-md transition-colors hover:bg-blue-900"
      >
        <Upload className="h-5 w-5" /> Dodaj Zdjęcia
      </button>

      {photos.length > 0 && (
        <div className="mt-5">
          <SectionTitle>Zdjęcia w Kolażu ({photos.length})</SectionTitle>
          <div className="custom-scrollbar flex snap-x gap-2 overflow-x-auto pb-2" data-testid="photo-list">
            {photos.map((p) => (
              <div key={p.id} className="group relative h-14 w-14 shrink-0 snap-start overflow-hidden rounded border border-slate-200 shadow-sm" data-testid="photo-thumb">
                <img src={urlOf(p.id)} alt={p.name} className="h-full w-full object-cover" draggable={false} />
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 transition-opacity hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:bg-black/30 [@media(hover:none)]:opacity-100"
                  title="Przenieś do magazynu"
                  aria-label={`Przenieś ${p.name || 'zdjęcie'} do magazynu`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onAdd}
              className="flex h-14 w-14 shrink-0 snap-start items-center justify-center rounded border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-brand hover:bg-slate-50 hover:text-brand"
              aria-label="Dodaj zdjęcia"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
