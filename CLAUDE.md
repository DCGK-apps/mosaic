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
  types.ts         model: Doc { photos, magazine, sheet, mode, tree, autoHistory, autoIndex, texts? }
                   TextBox: x,y = środek jako ułamek arkusza 0..1, sizeMm, font, bold/italic/underline, rotation…
                   tree = drzewo binarne: Leaf{photoId} | Split{dir 'V'|'H', frac, a, b}
                   Sheet w mm: widthMm, heightMm, gapMm, radiusMm, frameColor
                   Crop {x,y ∈ -1..1, zoom ≥ 1} – zdjęcie zawsze „cover”
  doc.ts           docReducer + DocAction (addPhotos, toMagazine, fromMagazine, deleteFromMagazine,
                   setMode, shuffle, autoStep, setFrac, moveEdge, isolate, joinLine, swap, setCrop, setSheet, rotateSheet,
                   addText, updateText, deleteText);
                   akcje losowe dostają `seed` (reducer jest czysty), DEFAULT_SHEET, emptyDoc
  layouts.ts       generatory układów (auto losuje wiele drzew i ocenia dopasowanie proporcji)
  geometry.ts      prostokąty pól/krawędzi w mm – WSPÓLNE dla podglądu i eksportu
  text.ts          napisy: FONTS, newTextBox, cleanText, layoutText (linie w mm – WSPÓLNE dla podglądu
                   i eksportu; pomiar przez Measure = canvas measureText), fontCss, moveText, snapAngle
  crop.ts tree.ts  kadrowanie; operacje na drzewie (setFrac ma tylko bezpieczne granice 1–99%)
  restructure.ts   isolateSegment / joinLine: przebudowa drzewa bez zmiany prostokątów pól, tak by chwycona część
                   przeciętej krawędzi była osobnym podziałem (obroty drzewa + refit ułamków z uwzględnieniem odstępu)
  edges.ts         przeciąganie krawędzi: beginEdgeDrag (zakres z minCellMm, cele przyciągania), dragFrac, moveEdge (inne krawędzie stoją), junctions (krzyżyki „+”), cellEdge (krawędź zdjęcia dla trybu Układ)
  history.ts       undo/redo; przeciąganie = `preview` (transient) + `end` → jeden krok
  export.ts        drawMosaic (canvas, na końcu drawTexts), canvasMeasure, exportSize (DPI, limity pikseli, iOS), nazwy plików:
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
  workspace/       Workspace (drop plików, „Dodaj napis”, zaznaczony napis), SheetView, Cell (kadrowanie, zamiana),
                   Divider (krawędź) + JunctionKnob (kropka w krzyżyku) – tylko uchwyty, useEdgeDrag (całe przeciąganie krawędzi), TextItem (napis + TextFrame z uchwytami), TextToolbar (pasek edycji napisu)
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
src/demoPhotos.ts  przykładowe zdjęcia (canvas) – przycisk `demo-photos` tylko w buildzie z VITE_DEMO_PHOTOS=1
                   (wersja testowa w podglądzie Claude, gdzie na telefonie nie działa wybór plików)
src/fonts.ts       czcionki napisów: registerFonts (FontFace z public/fonts, podzbiory latin/latin-ext),
                   loadFonts (przed eksportem), useTextMeasure (nowy pomiar po wczytaniu czcionki)
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
- „Zrób N kolaży” (`split === 'count'`, `BatchOptions.count`): `planCount` daje dokładnie N kolaży po ⌊n/N⌋ lub ⌈n/N⌉ zdjęć, a DP wybiera, które dostają dodatkowe zdjęcie (`layoutCost`). `checkCount`: `fewPhotos` (zdjęć < N, propozycja n) i `tooLarge` (> `HARD_MAX_PER_COLLAGE` = 40) blokują „Utwórz”. `large` (> 20) pokazuje w stopce okna `auto-large`: „Dobrze, zrób ⌈n/20⌉” / „Wróć do ustawień” / „Wiem, zrób mimo to”.
- `saveSeries` nie przerywa się na jednym kolażu: brak pamięci (`RenderError('memory')`) ponawia raz po 0,5 s, nieczytelne zdjęcie (`RenderError('photo')`) i błąd zapisu nie. Zwraca `{ saved, failed }`, a `SeriesSaveDialog` pokazuje raport z przyczynami i „Spróbuj ponownie” tylko dla nieudanych. Numer pliku = numer kolażu w panelu; puste kolaże są pomijane, a okno o tym informuje.
- E2E: `tests/e2e/series.spec.ts` – folder wybiera `setInputFiles(ASSETS)`, `showDirectoryPicker` jest podmieniany w `addInitScript`; `__mosaic.batch()` zwraca serię.

### Krawędzie (przeciąganie, krzyżyki)

Przełącznik narzędzi `ToolSwitch` (lewy górny róg płótna, także na telefonie; testid `tool-crop` / `tool-edges` / `tool-swap`, stan `tool` w `App`) decyduje, co robi przeciągnięcie zdjęcia: **Kadr** (kadrowanie, krawędzie i kropki też działają), **Układ** (zdjęcie nie kadruje się; przeciągnięcie w dowolnym miejscu zdjęcia rusza jego krawędź bliższą palcowi w osi ruchu – `cellEdge`; uchwyty widoczne, kropki większe), **Zamiana**. Na telefonie trafianie w cienkie krawędzie było zbyt trudne – stąd tryb Układ.

Sposoby chwytania (`useEdgeDrag` w `SheetView`, nasłuch na `window`, bo przebudowa drzewa podmienia elementy; wskaźnik jest przechwytywany przez arkusz – `setPointerCapture` – bo telefon kończy dotyk, gdy dotknięty element znika ze strony; kropki mają `key` = indeks, żeby kropka jadąca z linią zachowała element):
- **Krawędź** (`Divider`, kursor ↔/↕): rusza się tylko ten odcinek. Przy pierwszym ruchu `isolateSegment` tnie krawędź w każdym krzyżyku, gdzie prostopadła linia przechodzi na drugą stronę w tej samej pozycji (±0,01 mm). Chwycona część zachowuje `splitId`, druga dostaje `{id}~n`.
- **Zdjęcie w trybie Układ** (`onGrabCell`): kierunek pierwszego ruchu wybiera oś, potem jak przy krawędzi (tylko odcinek przy tym zdjęciu).
- **Krzyżyk** (`JunctionKnob`, testid `junction`, kursor `move`, kropka): `junctions(layout)` znajduje tylko „+” (nie T). Kierunek pierwszego ruchu (4 px) wybiera linię: w bok → pionowa, w górę/dół → pozioma. `joinLine` łączy części w jednej linii w jeden podział (najwyższy prostopadły przodek, przez który linia przechodzi), więc rusza się najdłuższa spójna linia.
- Akcje `isolate` / `joinLine` i `setFrac` są `transient` – całe przeciągnięcie to jeden krok cofania. Obraz w chwili przebudowy się nie zmienia (`refit` liczy ułamki z prostokątów pól, z odstępem).
- Przeciąganie używa akcji `moveEdge` (nie `setFrac`): wszystkie inne krawędzie zostają w miejscu, zmieniają się tylko zdjęcia przy krawędzi (zagnieżdżone podziały w tym samym kierunku dostają przeliczone ułamki). `setFrac` skalowałby wszystko proporcjonalnie, a inne linie „jechałyby” razem z nią.
- Zakres: żadne zdjęcie przy krawędzi nie spada poniżej `minCellMm` (15 mm, na małych arkuszach 6% krótszego boku). Zakres zawsze obejmuje pozycję startową, więc nic nie skacze.
- Przyciąganie (6 px, Shift wyłącza): tylko do innych krawędzi w tym samym kierunku – żeby łatwo zrobić krzyżyk. Przyciąganie do środków dawało wrażenie oporu.
- E2E: `tests/e2e/edges.spec.ts`. Przyciski zoomu komórki leżą nad krawędzią w prawej części pola, więc test dotykowy chwyta krawędź bliżej środka.

### Napisy

- Pliki czcionek (woff2 z Fontsource, OFL – `public/fonts/OFL.txt`) leżą obok `index.html`, nie są wklejane do pliku. Service worker zapisuje je w cache, więc działają offline. Polskie litery są w podzbiorze `latin-ext`.
- Podgląd rysuje każdą linię jako osobny `div` w pozycji z `layoutText`, eksport rysuje te same linie na canvasie – dlatego wyglądają tak samo. Napisy są przycinane do arkusza (warstwa `overflow-hidden`), a ramka z uchwytami (`TextFrame`) leży poza nią.
- Pisanie w polu i zmiana koloru to `transient`, krok historii kończy się na `blur`/„Gotowe”.
- E2E: `tests/e2e/text.spec.ts` (testid `text-add`, `text-box`, `text-input`, `text-font`, `text-resize`, `text-rotate`, `text-done`, `text-delete`…).

### Preferencje w localStorage (`mosaic.prefs`)

`dpi`, `exportType`, `installDismissed`, `lastProjectName`, `lastImageName`, `autoMin`, `autoMax`, `autoSplit` ('size' | 'count'), `autoCount`, `autoOrder`, `autoSubfolders`, `lastSeriesName`.

## Testy

- `tests/unit/*.test.ts` (Vitest, środowisko node). `helpers.ts` zawiera `leaf/split/photo`.
- `tests/e2e/*.spec.ts`, pomocnicze funkcje w `fixtures.ts`:
  - `openApp`, `addPhotos(page, ['landscape','portrait','square','wide'])` (pliki w `e2e/assets`),
  - `cells`, `getDoc` (czyta `window.__mosaic.doc()`),
  - `inPanel(page, fn)`: na telefonie otwiera szufladę, wykonuje `fn` i ją zamyka. Akcje w panelu zawsze opakowuj w `inPanel`.
- Zapis w e2e: kliknij `project-save` lub `export`, potem `filename-save` (albo Enter w `filename-input`), a na `download` czekaj przy tym drugim kliknięciu.
- Przed `page.reload()` wywołaj `__mosaic.flush()` i poczekaj na `body[data-ready="true"]`.
