import { SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar, UndoRedo } from './components/sidebar/Sidebar';
import { Workspace } from './components/workspace/Workspace';
import { cx } from './components/cx';
import { DEFAULT_DPI, DPI_OPTIONS, type ExportType } from './core/export';
import { exportMosaic } from './exporter';
import { DESKTOP, useMediaQuery } from './hooks/useMediaQuery';
import { useMosaic } from './hooks/useMosaic';
import { useUndoShortcuts } from './hooks/useShortcuts';
import { isProjectFile, ProjectError } from './storage/project';
import { loadPref, savePref } from './prefs';
import { toast } from './toast';

const plural = (n: number) => (n === 1 ? 'zdjęcie' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'zdjęcia' : 'zdjęć');

export function App() {
  const mosaic = useMosaic();
  const desktop = useMediaQuery(DESKTOP);
  const [swapMode, setSwapMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dpi, setDpi] = useState(() => {
    const saved = loadPref('dpi', DEFAULT_DPI);
    return (DPI_OPTIONS as readonly number[]).includes(saved) ? saved : DEFAULT_DPI;
  });
  const [exportType, setExportType] = useState<ExportType>(() => (loadPref<string>('exportType', 'jpeg') === 'png' ? 'png' : 'jpeg'));
  const [exporting, setExporting] = useState(false);
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
      if (n > 0) toast(`Dodano ${n} ${plural(n)}`);
      else if (files.length > 0) toast('Nie udało się wczytać zdjęć');
    },
    [addFiles, onOpenProject],
  );

  const onExport = async () => {
    setExporting(true);
    try {
      await exportMosaic(mosaic.doc, mosaic.urlOf, dpi, exportType);
    } catch {
      toast('Eksport nie powiódł się');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-[#f8f9fa] font-sans text-slate-900 md:flex-row">
      {/* Phone: top bar, settings in a drawer. */}
      <header className="flex items-center justify-between bg-brand px-3 py-2 text-white md:hidden">
        <span className="text-lg font-bold tracking-wide">Mosaic</span>
        <div className="flex items-center gap-1">
          <UndoRedo mosaic={mosaic} dark />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
            data-testid="drawer-open"
          >
            <SlidersHorizontal className="h-4 w-4" /> Ustawienia
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
          onExport={onExport}
          onSaveProject={() => {
            try {
              mosaic.saveProject();
            } catch {
              toast('Nie udało się zapisać projektu');
            }
          }}
          onOpenProject={() => projectInput.current?.click()}
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

      <Workspace mosaic={mosaic} swapMode={swapMode} onFiles={(f) => void onFiles(f)} />
    </div>
  );
}
