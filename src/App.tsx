import { ImagePlus, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AutoCollageDialog } from './components/AutoCollageDialog';
import { BatchPanel } from './components/BatchPanel';
import { FileNameDialog } from './components/FileNameDialog';
import { SeriesSaveDialog } from './components/SeriesSaveDialog';
import { NewProjectDialog } from './components/NewProjectDialog';
import { AppIcon, Sidebar, UndoRedo, type PanelTab } from './components/sidebar/Sidebar';
import { Workspace } from './components/workspace/Workspace';
import { cx } from './components/cx';
import { DEFAULT_DPI, defaultFileBase, DPI_OPTIONS, exportExt, type ExportType } from './core/export';
import { cleanName, rememberName, suggestName, type NameMemory } from './core/filename';
import { canChooseLocation, chooseLocation, type SaveTarget } from './download';
import type { SeriesResult } from './autoCollage';
import { exportMosaic } from './exporter';
import { DESKTOP, useMediaQuery } from './hooks/useMediaQuery';
import { useMosaic } from './hooks/useMosaic';
import { useUndoShortcuts } from './hooks/useShortcuts';
import { isProjectFile, PROJECT_EXT, ProjectError } from './storage/project';
import { loadPref, savePref } from './prefs';
import { collagesWord, photosWord } from './plural';
import { toast } from './toast';
import { demoPhotos } from './demoPhotos';

type SaveKind = 'project' | 'image';
/** Last file name per kind, remembered between sessions. */
const nameKey = (kind: SaveKind) => (kind === 'project' ? 'lastProjectName' : 'lastImageName');


export function App() {
  const mosaic = useMosaic();
  const desktop = useMediaQuery(DESKTOP);
  const [swapMode, setSwapMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('options');
  const [newDialog, setNewDialog] = useState(false);
  const [dpi, setDpi] = useState(() => {
    const saved = loadPref('dpi', DEFAULT_DPI);
    return (DPI_OPTIONS as readonly number[]).includes(saved) ? saved : DEFAULT_DPI;
  });
  const [exportType, setExportType] = useState<ExportType>(() => (loadPref<string>('exportType', 'jpeg') === 'png' ? 'png' : 'jpeg'));
  const [exporting, setExporting] = useState(false);
  /** Open "file name" dialog: what is being saved and what to do after a successful save. */
  const [saveAs, setSaveAs] = useState<{ kind: SaveKind; after?: () => void } | null>(null);
  /** Computer only: the automatic series – its dialog, the "save all" dialog and the side panel. */
  const [autoDialog, setAutoDialog] = useState(false);
  const [seriesSave, setSeriesSave] = useState(false);
  const [batchOpen, setBatchOpen] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  useUndoShortcuts(mosaic.undo, mosaic.redo);

  useEffect(() => {
    if (mosaic.ready) document.body.dataset.ready = 'true';
  }, [mosaic.ready]);

  const { addFiles, openProject } = mosaic;
  const onOpenProject = useCallback(
    async (file: File) => {
      try {
        await openProject(file);
        toast('Otwarto projekt');
      } catch (e) {
        toast(e instanceof ProjectError ? e.message : 'Nie udało się otworzyć projektu');
      }
    },
    [openProject],
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      // A project file dropped on the canvas opens it.
      const project = files.find(isProjectFile);
      if (project) return onOpenProject(project);
      const n = await addFiles(files);
      if (n > 0) toast(`Dodano ${n} ${photosWord(n)}`);
      else if (files.length > 0) toast('Nie udało się wczytać zdjęć');
    },
    [addFiles, onOpenProject],
  );

  /** Renders and downloads the collage image; false when it failed (the user was told). */
  const onExport = async (name: string, target?: SaveTarget): Promise<boolean> => {
    setExporting(true);
    try {
      await exportMosaic(mosaic.doc, mosaic.urlOf, dpi, exportType, name, target);
      return true;
    } catch {
      toast('Eksport nie powiódł się');
      return false;
    } finally {
      setExporting(false);
    }
  };

  const onSaveProject = async (name: string, target?: SaveTarget): Promise<boolean> => {
    try {
      await mosaic.saveProject(name, target);
      return true;
    } catch {
      toast('Nie udało się zapisać projektu');
      return false;
    }
  };

  const nameMemory = (kind: SaveKind) => {
    const m = loadPref<NameMemory | null>(nameKey(kind), null);
    return m && typeof m.base === 'string' && Number.isInteger(m.n) && m.n >= 0 ? m : null;
  };

  const saveExt = (kind: SaveKind) => (kind === 'project' ? PROJECT_EXT : exportExt(exportType));

  /**
   * Saves under the name from the dialog; the name is remembered once the save worked.
   * `chooseFolder`: first the system "Save as" window, where the user picks the folder
   * (and may change the name); closing it leaves the name dialog open.
   */
  const onSaveAs = async (kind: SaveKind, name: string, then?: () => void, chooseFolder = false) => {
    const ext = saveExt(kind);
    let target: SaveTarget | undefined;
    if (chooseFolder) {
      try {
        const description = kind === 'project' ? 'Projekt Mosaic' : exportType === 'png' ? 'Obraz PNG' : 'Obraz JPG';
        const mime = kind === 'project' ? 'application/octet-stream' : `image/${exportType}`;
        target = (await chooseLocation(name + ext, kind, mime, ext, description)) ?? undefined;
      } catch {
        toast('Nie udało się otworzyć okna zapisu');
        return;
      }
      if (!target) return;
    }
    setSaveAs(null);
    const ok = kind === 'project' ? await onSaveProject(name, target) : await onExport(name, target);
    if (!ok) return;
    const saved = target ? cleanName(target.name, ext) || name : name;
    savePref(nameKey(kind), rememberName(saved, nameMemory(kind)));
    if (target) toast(`Zapisano: ${target.name}`);
    then?.();
  };

  const startNewProject = () => {
    mosaic.newProject();
    setNewDialog(false);
    setDrawerOpen(false);
    setSwapMode(false);
    toast('Nowy projekt');
  };

  const onSeriesDone = (result: SeriesResult) => {
    mosaic.startBatch(result.entries, result.docs);
    setAutoDialog(false);
    setBatchOpen(true);
    setSwapMode(false);
    const photos = result.docs.reduce((s, d) => s + d.photos.length, 0);
    toast(`Utworzono ${result.docs.length} ${collagesWord(result.docs.length)} z ${photos} ${photosWord(photos)}${result.skipped ? ` (pominięto ${result.skipped})` : ''}`);
  };

  /** The collages to save, the edited one as it is now (the dialog skips empty ones). */
  const seriesDocs = () => mosaic.batch.map((d) => (d.batchKey === mosaic.doc.batchKey ? mosaic.doc : d));

  const openDrawer = (t: PanelTab) => {
    setTab(t);
    setDrawerOpen(true);
  };

  return (
    <div className="flex h-dvh flex-col bg-[#f8f9fa] font-sans text-slate-900 md:flex-row">
      {/* Phone: top bar, photos and options in a drawer with two tabs. */}
      <header className="flex items-center justify-between gap-2 bg-brand px-3 py-2 max-[400px]:px-2 text-white md:hidden">
        <span className="flex min-w-0 items-center gap-1.5 text-lg font-bold tracking-wide max-[400px]:text-base max-[400px]:tracking-normal">
          <AppIcon className="h-7 w-7 max-[400px]:h-6 max-[400px]:w-6" /> Mosaic
        </span>
        <div className="flex flex-none items-center gap-1">
          <UndoRedo mosaic={mosaic} dark />
          <button
            type="button"
            onClick={() => openDrawer('photos')}
            className="flex items-center gap-1.5 flex-none whitespace-nowrap rounded-md bg-white/10 px-2.5 py-1.5 max-[400px]:px-2 text-sm font-medium hover:bg-white/20"
            data-testid="drawer-photos"
          >
            <ImagePlus className="h-4 w-4 max-[440px]:hidden" /> Dodaj zdjęcia
          </button>
          <button
            type="button"
            onClick={() => openDrawer('options')}
            className="flex items-center gap-1.5 flex-none whitespace-nowrap rounded-md bg-white/10 px-2.5 py-1.5 max-[400px]:px-2 text-sm font-medium hover:bg-white/20"
            data-testid="drawer-open"
          >
            <SlidersHorizontal className="h-4 w-4 max-[440px]:hidden" /> Opcje
          </button>
        </div>
      </header>

      {!desktop && drawerOpen && <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setDrawerOpen(false)} data-testid="drawer-backdrop" />}

      <aside
        data-testid="sidebar"
        inert={!desktop && !drawerOpen}
        className={cx(
          'z-40 flex flex-col overflow-y-auto bg-white shadow-lg',
          'fixed inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl transition-transform duration-200',
          'md:static md:z-20 md:max-h-none md:w-80 md:shrink-0 md:translate-y-0 md:rounded-none md:border-r md:border-slate-200',
          drawerOpen ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <Sidebar
          mosaic={mosaic}
          swapMode={swapMode}
          onSwapMode={setSwapMode}
          onAddPhotos={() => fileInput.current?.click()}
          onDemoPhotos={
            import.meta.env.VITE_DEMO_PHOTOS === '1'
              ? () => {
                  toast('Tworzę przykładowe zdjęcia…');
                  void demoPhotos().then(onFiles);
                }
              : undefined
          }
          dpi={dpi}
          exportType={exportType}
          exporting={exporting}
          onDpi={(d) => {
            setDpi(d);
            savePref('dpi', d);
          }}
          onExportType={(t) => {
            setExportType(t);
            savePref('exportType', t);
          }}
          onExport={() => setSaveAs({ kind: 'image' })}
          onSaveProject={() => setSaveAs({ kind: 'project' })}
          onOpenProject={() => projectInput.current?.click()}
          onNewProject={() => setNewDialog(true)}
          onAutoCollage={desktop ? () => setAutoDialog(true) : undefined}
          tab={tab}
          onTab={setTab}
          onClose={() => setDrawerOpen(false)}
        />
      </aside>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/*"
        hidden
        data-testid="file-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void onFiles(files);
        }}
      />

      {/* No `accept`: phones grey out files with an unknown extension like .mosaic. */}
      <input
        ref={projectInput}
        type="file"
        hidden
        data-testid="project-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onOpenProject(file);
        }}
      />

      {newDialog && (
        <NewProjectDialog
          canExport={mosaic.doc.photos.length > 0}
          imageLabel={`${exportType === 'png' ? 'PNG' : 'JPG'} · ${dpi} DPI`}
          busy={exporting}
          onSaveProject={() => setSaveAs({ kind: 'project', after: startNewProject })}
          onSaveImage={() => setSaveAs({ kind: 'image', after: startNewProject })}
          onDiscard={startNewProject}
          onCancel={() => setNewDialog(false)}
        />
      )}

      {saveAs && (
        <FileNameDialog
          title={saveAs.kind === 'project' ? 'Zapisz projekt' : 'Zapisz kolaż'}
          initial={suggestName(nameMemory(saveAs.kind), defaultFileBase(mosaic.doc.sheet))}
          ext={saveExt(saveAs.kind)}
          onSave={(name) => void onSaveAs(saveAs.kind, name, saveAs.after)}
          onSaveTo={canChooseLocation() ? (name) => void onSaveAs(saveAs.kind, name, saveAs.after, true) : undefined}
          onCancel={() => setSaveAs(null)}
        />
      )}

      {desktop && autoDialog && (
        <AutoCollageDialog sheet={mosaic.doc.sheet} mode={mosaic.doc.mode} existing={mosaic.batch.length} onDone={onSeriesDone} onCancel={() => setAutoDialog(false)} />
      )}

      {desktop && seriesSave && (
        <SeriesSaveDialog
          docs={seriesDocs()}
          urlOf={mosaic.urlOf}
          dpi={dpi}
          type={exportType}
          onDpi={(d) => {
            setDpi(d);
            savePref('dpi', d);
          }}
          onType={(t) => {
            setExportType(t);
            savePref('exportType', t);
          }}
          onClose={() => setSeriesSave(false)}
        />
      )}

      <Workspace mosaic={mosaic} swapMode={swapMode} onFiles={(f) => void onFiles(f)} />

      {desktop && mosaic.batch.length > 0 && (
        <BatchPanel mosaic={mosaic} open={batchOpen} onOpen={setBatchOpen} onSaveAll={() => setSeriesSave(true)} onNewSeries={() => setAutoDialog(true)} />
      )}
    </div>
  );
}
