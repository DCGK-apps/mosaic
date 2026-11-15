# Mosaic – notatki dla Claude

Kreator kolaży zdjęć do druku. React 19 + TypeScript (strict) + Tailwind 4 + Vite, budowany do **jednego pliku** `dist/index.html` (vite-plugin-singlefile) + manifest, ikony i service worker. PWA, działa offline, publikowany na GitHub Pages (https://dcgk-apps.github.io/mosaic/) z gałęzi `main`. Opis funkcji dla użytkownika: `README.md`.

## Konwencje

- **Interfejs po polsku** (teksty, toasty), **kod, komentarze i nazwy testów po angielsku**. Commity po angielsku.
- Użytkownik pisze po polsku i odpowiadamy po polsku.
- Logika bez Reacta i DOM trafia do `src/core/` i dostaje testy jednostkowe. Komponenty tylko wywołują te funkcje.
- Elementy, których dotykają testy, mają `data-testid`. Nowy przycisk lub okno też dostaje testid.
- Lint (`oxlint --deny-warnings`) blokuje też ostrzeżenia. Typowe wpadki: obiekt z polem `then` (`unicorn/no-thenable`, nazwij je np. `after`), znaki sterujące w regexie (`no-control-regex`).
- Okna modalne: nakładka `fixed inset-0 bg-black/40`, Escape = anuluj. Wzór: `NewProjectDialog.tsx` (z-60) i `FileNameDialog.tsx` (z-70, otwiera się nad tamtym).
- Kolor marki: klasa `brand` (`bg-brand`, `text-brand`).

## Komendy

```bash
npm ci                       # w świeżym kontenerze najpierw to – bez tego tsc nie widzi typów node/vite
npm run typecheck && npm run lint && npm test
npx playwright test --trace off   # e2e; sam robi build + preview na porcie 4173
```

E2E działa w dwóch projektach, `desktop` i `mobile` (Pixel 7). Pełny przebieg trwa około 40 s. Chromium jest w kontenerze preinstalowany, więc `playwright install` nie jest potrzebne. CI (`.github/workflows/ci.yml`) uruchamia typecheck, lint, test, e2e i e2e:slow. `pages.yml` wdraża z `main`.

## Architektura (gdzie co jest)

```
src/core/          czysta logika (testy w tests/unit)
  types.ts         model: Doc { photos, magazine, sheet, mode, tree, autoHistory, autoIndex }
                   tree = drzewo binarne: Leaf{photoId} | Split{dir 'V'|'H', frac, a, b}
                   Sheet w mm: widthMm, heightMm, gapMm, radiusMm, frameColor
                   Crop {x,y ∈ -1..1, zoom ≥ 1} – zdjęcie zawsze „cover”
  doc.ts           docReducer + DocAction (addPhotos, toMagazine, fromMagazine, deleteFromMagazine,
                   setMode, shuffle, autoStep, setFrac, swap, setCrop, setSheet, rotateSheet);
                   akcje losowe dostają `seed` (reducer jest czysty), DEFAULT_SHEET, emptyDoc
  layouts.ts       generatory układów (auto losuje wiele drzew i ocenia dopasowanie proporcji)
  geometry.ts      prostokąty pól/krawędzi w mm – WSPÓLNE dla podglądu i eksportu
  crop.ts tree.ts  kadrowanie; operacje na drzewie
  history.ts       undo/redo; przeciąganie = `preview` (transient) + `end` → jeden krok
  export.ts        drawMosaic (canvas), exportSize (DPI, limity pikseli, iOS), nazwy plików:
                   defaultFileBase(sheet) = "kolaz_{W}x{H}mm", exportExt, exportFileName
  filename.ts      nazwa pliku przy zapisie: suggestName / rememberName / cleanName
  batch.ts         seria „Kolaże z folderu”: inChosenFolder (bez podfolderów), sortFiles, planBatch (DP – podział na kolaże), buildBatch,
                   writeBack, seriesFileBase ("nazwa_001"); MAX_BATCH_PHOTOS = 500, MAX_PER_COLLAGE = 20
  exif.ts          data wykonania z EXIF (DateTimeOriginal / DateTime) z pierwszych 128 KB pliku JPEG
  zip.ts           zapis ZIP bez kompresji (crc32, zipParts)
  formats.ts random.ts
src/storage/
  db.ts            IndexedDB „mosaic” (wersja 2) – autozapis dokumentu, serii (klucz „batch”),
                   blobów zdjęć (store images) i miniatur zdjęć serii (store thumbs)
  serialize.ts     toSaved/restoreDoc, toSavedBatch/restoreBatch – bezpieczne odtwarzanie (walidacja, SAVE_VERSION)
  project.ts       plik .mosaic: "MOSAICP1" + uint32 długość + JSON manifest + surowe pliki zdjęć
src/hooks/
  useMosaic.ts     CAŁY stan aplikacji: historia (useReducer), mapa zdjęć id→{blob,url},
                   autozapis (debounce 400 ms), addFiles, saveProject(name?), openProject,
                   newProject, undo/redo. Wystawia window.__mosaic {doc(), flush()} dla testów.
  useShortcuts.ts  Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
src/components/
  sidebar/         Sidebar + sekcje: Photos, Magazine, Layout, Size, Style, Export, Project
  workspace/       Workspace (drop plików), SheetView, Cell (kadrowanie, zamiana), Divider (krawędź)
  NewProjectDialog.tsx  „Nowy projekt”: zapisać? → jako projekt / jako obraz
  FileNameDialog.tsx    pole „Nazwa pliku” + rozszerzenie, Enter/Escape
  AutoCollageDialog.tsx „Kolaże z folderu” (z-60): folder, od–do, kolejność, układ, format, ramka; postęp
  BatchPanel.tsx        prawy panel z miniaturami serii (canvas, drawMosaic na miniaturach zdjęć)
  SeriesSaveDialog.tsx  „Zapisz wszystkie” (z-60): nazwa_001…, folder (showDirectoryPicker) albo ZIP
src/App.tsx        układ strony, szuflada na telefonie (zakładki photos/options), eksport,
                   zapis projektu, okna dialogowe, preferencje dpi/exportType
src/exporter.ts    eksport do pliku: renderMosaic (canvas → blob) + exportMosaic (download)
src/autoCollage.ts seria po stronie przeglądarki: createSeries (EXIF, odczyt, miniatury, plan), saveSeries
src/plural.ts      odmiana: photosWord, collagesWord
src/download.ts    pobranie bloba przez <a download>
src/prefs.ts       localStorage „mosaic.prefs” (loadPref/savePref)
src/pwa.ts sw-template.js  instalacja, baner „Dostępna nowa wersja”; sw.js generuje vite.config.ts
src/toast.ts       krótki komunikat na górze ekranu
```

### Przepływ zapisu (po zmianie z 2026-11)

Przyciski „Zapisz projekt” i „Zapisz Kolaż na Dysku” oraz opcje w `NewProjectDialog` nie zapisują od razu. Ustawiają w `App.tsx` stan `saveAs = { kind: 'project' | 'image', after? }`, a ten otwiera `FileNameDialog`. Po zatwierdzeniu `onSaveAs` zapisuje plik (`mosaic.saveProject(name)` albo `exportMosaic(..., name)`). Dopiero gdy zapis się uda, zapamiętuje nazwę w prefs (`lastProjectName` / `lastImageName`, osobno dla projektów i obrazów) i wywołuje `after` (np. startNewProject).

„Zapisz w…” (`filename-save-to`, tylko gdy `canChooseLocation()` – Chrome/Edge na komputerze): `onSaveAs(..., chooseFolder=true)` najpierw otwiera `chooseLocation` (`showSaveFilePicker`, `id` = `mosaic-image` / `mosaic-project`, więc przeglądarka pamięta folder osobno dla obrazów i projektów). Zamknięcie okna zostawia `FileNameDialog` otwarty. Zapamiętywana jest nazwa wybrana w oknie systemu. `exportMosaic` i `saveProject` przyjmują opcjonalny `SaveTarget`. E2E: `tests/e2e/save-to.spec.ts` (podmieniony `showSaveFilePicker`).

Numeracja nazw: pierwsza podpowiedź to `kolaz_504x506mm`, potem ostatnia nazwa + dwucyfrowy numer (`wakacje` → `wakacje01` → `wakacje02`, po 99 jest 100). Dwie cyfry na końcu wpisane przez użytkownika liczą się jako licznik. Inne liczby (rok, wymiar) są częścią nazwy. Domyślna nazwa kończy się na „mm” właśnie dlatego, żeby wymiaru nie uznać za licznik.

### Seria „Kolaże z folderu” (tylko komputer)

Na telefonie niewidoczna: `App` przekazuje `onAutoCollage` i renderuje `BatchPanel` tylko gdy `desktop`.

- Każdy kolaż serii to zwykły `Doc` z polem `batchKey`. Seria to `Doc[]` w `useMosaic` (`batch`).
- Edytowany kolaż żyje w `doc` (historia undo). `batch` jest liczony jako `writeBack(storedBatch, doc)`, więc panel zawsze pokazuje bieżący stan. Do `storedBatch` kolaż trafia (`keepBatch`) dopiero, gdy edytor przechodzi na coś innego: inny kolaż (`selectBatch`), nowy lub otwarty projekt. Dzięki temu Ctrl+Z przechodzi spójnie między kolażami.
- Magazyn odłożonych należy do edytora, nie do kolażu: `selectBatch` przenosi go do otwieranego kolażu, a kopie w serii mają pusty magazyn (`batchCopy`).
- Otwarty projekt `.mosaic` traci `batchKey` (to samodzielny kolaż).
- Autozapis trzyma zdjęcia z `doc` ∪ wszystkich kolaży serii; miniatury zdjęć (240 px) osobno w store `thumbs`.
- `planBatch`: programowanie dynamiczne po kolejnych zdjęciach; koszt kolażu = `layoutCost` (te same kryteria co Auto) × liczba zdjęć + lekka kara za nierówne rozmiary + duża kara za wyjście poza zakres (tylko gdy zakresu nie da się spełnić). Dla 500 zdjęć i zakresu 2–20 trwa ~4 s, dlatego jest async z `tick` (postęp, przerwanie).
- `saveSeries` nie przerywa się na jednym kolażu: brak pamięci (`RenderError('memory')`) ponawia raz po 0,5 s, nieczytelne zdjęcie (`RenderError('photo')`) i błąd zapisu nie. Zwraca `{ saved, failed }`, a `SeriesSaveDialog` pokazuje raport z przyczynami i „Spróbuj ponownie” tylko dla nieudanych. Numer pliku = numer kolażu w panelu; puste kolaże są pomijane, a okno o tym informuje.
- E2E: `tests/e2e/series.spec.ts` – folder wybiera `setInputFiles(ASSETS)`, `showDirectoryPicker` jest podmieniany w `addInitScript`; `__mosaic.batch()` zwraca serię.

### Preferencje w localStorage (`mosaic.prefs`)

`dpi`, `exportType`, `installDismissed`, `lastProjectName`, `lastImageName`, `autoMin`, `autoMax`, `autoOrder`, `autoSubfolders`, `lastSeriesName`.

## Testy

- `tests/unit/*.test.ts` (Vitest, środowisko node). `helpers.ts` zawiera `leaf/split/photo`.
- `tests/e2e/*.spec.ts`, pomocnicze funkcje w `fixtures.ts`:
  - `openApp`, `addPhotos(page, ['landscape','portrait','square','wide'])` (pliki w `e2e/assets`),
  - `cells`, `getDoc` (czyta `window.__mosaic.doc()`),
  - `inPanel(page, fn)`: na telefonie otwiera szufladę, wykonuje `fn` i ją zamyka. Akcje w panelu zawsze opakowuj w `inPanel`.
- Zapis w e2e: kliknij `project-save` lub `export`, potem `filename-save` (albo Enter w `filename-input`), a na `download` czekaj przy tym drugim kliknięciu.
- Przed `page.reload()` wywołaj `__mosaic.flush()` i poczekaj na `body[data-ready="true"]`.
