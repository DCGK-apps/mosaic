import { FilePlus, Images, Redo2, SlidersHorizontal, Undo2, X } from 'lucide-react';
import { cx } from '../cx';
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

/** On a phone the panel shows one tab at a time; on a computer everything is visible. */
export type PanelTab = 'photos' | 'options';

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
  onNewProject: () => void;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  /** Mobile only: closes the drawer. */
  onClose?: () => void;
}

/** The app's own icon (the same as on the home screen). */
export function AppIcon({ className }: { className?: string }) {
  return <img src="./icons/icon-192.png" alt="" draggable={false} className={`${className ?? ''} shrink-0 rounded-lg bg-white`} data-testid="app-icon" />;
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
  const { mosaic, swapMode, onSwapMode, onAddPhotos, onClose, tab, onTab } = props;
  const { doc, act, endGesture, urlOf } = mosaic;
  const hasPhotos = doc.photos.length > 0;

  return (
    <>
      <div className="relative bg-brand p-6 text-center text-white">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-wide">
          <AppIcon className="h-8 w-8" /> Mosaic
        </h1>
        <p className="mt-1 text-sm text-blue-200 opacity-80">Idealne dopasowanie</p>
        <div className="absolute left-3 top-3 hidden md:block">
          <UndoRedo mosaic={mosaic} dark />
        </div>
        <button
          type="button"
          onClick={props.onNewProject}
          disabled={doc.photos.length === 0 && doc.magazine.length === 0}
          className="absolute right-3 top-3 hidden items-center gap-1 rounded p-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent md:flex"
          title="Nowy projekt"
          data-testid="header-new"
        >
          <FilePlus className="h-5 w-5" /> Nowy
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded p-1.5 text-white/80 hover:bg-white/10 md:hidden" aria-label="Zamknij panel" data-testid="drawer-close">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex border-b border-slate-200 md:hidden" role="tablist" aria-label="Panel">
        {(
          [
            ['photos', Images, 'Zdjęcia'],
            ['options', SlidersHorizontal, 'Opcje'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTab(id)}
            data-testid={`tab-${id}`}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm font-bold transition-colors',
              tab === id ? 'border-brand text-brand' : 'border-transparent text-slate-500',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
            {id === 'photos' && doc.photos.length > 0 && <span className="text-xs font-medium opacity-70">({doc.photos.length})</span>}
          </button>
        ))}
      </div>

      {/* Photos tab */}
      <div className={cx('p-6 md:pb-0', tab !== 'photos' && 'max-md:hidden')} role="tabpanel" data-testid="panel-photos">
        <div>
          <PhotosSection photos={doc.photos} urlOf={urlOf} onAdd={onAddPhotos} onRemove={(photoId) => act({ type: 'toMagazine', photoId })} />
          <MagazineSection
            photos={doc.magazine}
            urlOf={urlOf}
            onRestore={(photoId) => act({ type: 'fromMagazine', photoId })}
            onDelete={(photoId) => act({ type: 'deleteFromMagazine', photoId })}
          />
        </div>
      </div>

      {/* Options tab */}
      <div className={cx('flex flex-col gap-6 p-6', tab !== 'options' && 'max-md:hidden')} role="tabpanel" data-testid="panel-options">
        <div className="hidden md:block">
          <Separator />
        </div>

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

        <ProjectSection empty={doc.photos.length === 0 && doc.magazine.length === 0} onSave={props.onSaveProject} onOpen={props.onOpenProject} onNew={props.onNewProject} />
      </div>
    </>
  );
}
