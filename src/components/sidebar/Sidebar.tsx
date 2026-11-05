import { Image as ImageIcon, Redo2, Undo2, X } from 'lucide-react';
import type { ExportType } from '../../core/export';
import type { Mosaic } from '../../hooks/useMosaic';
import { ExportSection } from './ExportSection';
import { LayoutSection } from './LayoutSection';
import { MagazineSection } from './MagazineSection';
import { PhotosSection } from './PhotosSection';
import { ProjectSection } from './ProjectSection';
import { SizeSection } from './SizeSection';
import { StyleSection } from './StyleSection';
import { Separator } from './ui';

export interface SidebarProps {
  mosaic: Mosaic;
  swapMode: boolean;
  onSwapMode: (swap: boolean) => void;
  onAddPhotos: () => void;
  dpi: number;
  exportType: ExportType;
  exporting: boolean;
  onDpi: (dpi: number) => void;
  onExportType: (type: ExportType) => void;
  onExport: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  /** Mobile only: closes the drawer. */
  onClose?: () => void;
}

export function UndoRedo({ mosaic, dark }: { mosaic: Mosaic; dark?: boolean }) {
  const cls = dark
    ? 'rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent'
    : 'rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="flex gap-1">
      <button type="button" className={cls} onClick={mosaic.undo} disabled={!mosaic.canUndo} title="Cofnij (Ctrl+Z)" aria-label="Cofnij" data-testid="undo">
        <Undo2 className="h-5 w-5" />
      </button>
      <button type="button" className={cls} onClick={mosaic.redo} disabled={!mosaic.canRedo} title="Ponów (Ctrl+Shift+Z)" aria-label="Ponów" data-testid="redo">
        <Redo2 className="h-5 w-5" />
      </button>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const { mosaic, swapMode, onSwapMode, onAddPhotos, onClose } = props;
  const { doc, act, endGesture, urlOf } = mosaic;
  const hasPhotos = doc.photos.length > 0;

  return (
    <>
      <div className="relative bg-brand p-6 text-center text-white">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-wide">
          <ImageIcon className="h-6 w-6" /> Mosaic
        </h1>
        <p className="mt-1 text-sm text-blue-200 opacity-80">Idealne dopasowanie</p>
        <div className="absolute left-3 top-3 hidden md:block">
          <UndoRedo mosaic={mosaic} dark />
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded p-1.5 text-white/80 hover:bg-white/10 md:hidden" aria-label="Zamknij ustawienia" data-testid="drawer-close">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <PhotosSection photos={doc.photos} urlOf={urlOf} onAdd={onAddPhotos} onRemove={(photoId) => act({ type: 'toMagazine', photoId })} />
          <MagazineSection
            photos={doc.magazine}
            urlOf={urlOf}
            onRestore={(photoId) => act({ type: 'fromMagazine', photoId })}
            onDelete={(photoId) => act({ type: 'deleteFromMagazine', photoId })}
          />
        </div>

        <Separator />

        {hasPhotos && (
          <>
            <LayoutSection
              mode={doc.mode}
              autoIndex={doc.autoIndex}
              autoCount={doc.autoHistory.length}
              swapMode={swapMode}
              onMode={(mode) => act({ type: 'setMode', mode })}
              onAutoStep={(delta) => act({ type: 'autoStep', delta })}
              onShuffle={() => act({ type: 'shuffle' })}
              onSwapMode={onSwapMode}
            />
            <Separator />
          </>
        )}

        <SizeSection sheet={doc.sheet} onSheet={(patch) => act({ type: 'setSheet', patch })} onRotate={() => act({ type: 'rotateSheet' })} />
        <StyleSection sheet={doc.sheet} onSheet={(patch, transient) => act({ type: 'setSheet', patch }, { transient })} onEnd={endGesture} />

        <Separator />

        <ExportSection
          sheet={doc.sheet}
          disabled={!hasPhotos}
          exporting={props.exporting}
          dpi={props.dpi}
          type={props.exportType}
          onDpi={props.onDpi}
          onType={props.onExportType}
          onExport={props.onExport}
        />

        <Separator />

        <ProjectSection empty={doc.photos.length === 0 && doc.magazine.length === 0} onSave={props.onSaveProject} onOpen={props.onOpenProject} />
      </div>
    </>
  );
}
