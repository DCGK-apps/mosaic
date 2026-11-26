# Mosaic

Kreator kolaży zdjęć do druku. Działa w przeglądarce i na telefonie (PWA, także offline), budowany do jednego pliku `index.html` i publikowany na GitHub Pages:
**https://dcgk-apps.github.io/mosaic/**

## Funkcje

- **Układy:** Auto (losuje tysiące podziałów i wybiera najlepiej pasujący do proporcji zdjęć, z historią losowań), Siatka, Centralny, Poziomo, Pionowo.
- **Przełącznik na płótnie: Kadr / Układ / Zamiana** – co robi przeciągnięcie zdjęcia. W trybie **Układ** nie trzeba trafiać w krawędź: przeciągnięcie w dowolnym miejscu zdjęcia przesuwa jego krawędź bliższą palcowi (ruch w bok – lewą lub prawą, w górę/dół – górną lub dolną). Wygodne zwłaszcza na telefonie.
- **Krawędzie** między zdjęciami można przeciągać (myszą i palcem):
  - przesuwana krawędź zmienia tylko zdjęcia tuż przy niej, pozostałe krawędzie stoją w miejscu,
  - krawędź przyciąga się do innych krawędzi w jednej linii (Shift – bez przyciągania), więc łatwo zrobić „krzyżyk”,
  - chwycenie krawędzi (kursor ↔ / ↕) przesuwa tylko ten jeden odcinek – także połowę linii przeciętej przez inną. Układ przebudowuje się w locie, nic nie przeskakuje,
  - w krzyżyku jest kropka (kursor ✥): przeciągnięcie jej przesuwa całą najdłuższą spójną linię – w bok pionową, w górę lub w dół poziomą,
  - pole nie robi się węższe niż 15 mm (na małych arkuszach mniej).
- **Kadrowanie:** przeciąganie zdjęcia, powiększanie przyciskami, kółkiem myszy lub szczypaniem. Zdjęcie zawsze wypełnia pole, nie da się zrobić pustej dziury.
- **Napisy:** przycisk „Dodaj napis” nad arkuszem. Napis z polskimi znakami, w kilku liniach, można dowolnie przesuwać, powiększać (kółko w rogu) i obracać (uchwyt u góry, przyciąga do 0°/45°/90°). Pasek pod arkuszem: 7 czcionek (Roboto, Lora, Playfair Display, Oswald, Caveat, Pacifico, Comfortaa – wbudowane, działają offline i wyglądają tak samo na każdym urządzeniu), rozmiar w mm wydruku, pogrubienie, kursywa, podkreślenie, wyrównanie, cień, kolor. Dwuklik na napisie – edycja treści, Delete – usunięcie. Napisy są w eksporcie, projekcie `.mosaic` i autozapisie.
- **Zamiana miejsc:** w trybie „Zamiana” przeciągnięcie zdjęcia na inne (działa też dotykiem).
- **Magazyn odłożonych** zdjęć: odłóż, przywróć, usuń trwale.
- **Wymiary:** gotowe formaty (A4, A3, 30 × 40 cm…) lub własne, obrót pion/poziom; ramka i zaokrąglenie w milimetrach wydruku. Ramka jest między zdjęciami, a po zaznaczeniu „Ramka dookoła” także wokół całego kolażu (domyślnie wyłączone).
- **Eksport** do JPG/PNG w 100/150/300 DPI. Plik wygląda dokładnie jak podgląd (ta sama geometria).
- **Projekt do dalszej edycji:** „Zapisz projekt” tworzy plik `.mosaic` (oryginalne zdjęcia, układ, kadry, ustawienia arkusza i magazyn). „Otwórz projekt” – albo przeciągnięcie pliku `.mosaic` na płótno – przywraca kolaż do edycji, także na innym urządzeniu; otwarcie można cofnąć.
- **Nazwa pliku przy zapisie:** przed zapisem projektu lub obrazu można podać nazwę pliku. Program pamięta ostatnią i następnym razem podpowiada ją z kolejnym numerem (`wakacje` → `wakacje01` → `wakacje02`). W Chrome i Edge na komputerze przycisk „Zapisz w…” otwiera systemowe okno zapisu, w którym wybiera się folder (okno zaczyna w ostatnio użytym); „Zapisz” zapisuje do folderu pobranych plików.
- **Nowy projekt:** czyści arkusz (format i styl zostają). Najpierw pyta, czy zapisać obecną pracę – jako projekt `.mosaic` albo jako obraz (JPG/PNG w wybranej jakości). Można to cofnąć.
- **Kolaże z folderu** (tylko na komputerze): wskazujesz folder ze zdjęciami (do 500; zdjęcia z podfolderów tylko po zaznaczeniu „Uwzględnij zdjęcia z podfolderów”), liczbę zdjęć w kolażu „od – do” albo liczbę kolaży („Zrób N kolaży”), kolejność (data wykonania z EXIF, nazwa pliku albo losowo), układ, format i ramkę. Program dzieli wszystkie zdjęcia po kolei na kolaże i sam dobiera liczbę zdjęć w każdym z podanego zakresu tak, żeby najlepiej pasowały do układu. Przy „Zrób N kolaży” zdjęcia dzielą się po równo (liczby różnią się najwyżej o jedno). Gdy zdjęć jest za mało, program proponuje mniej kolaży. Powyżej 20 zdjęć w kolażu pyta, czy na pewno, a więcej niż 40 nie pozwala. Kolaże widać jako miniatury w wysuwanym panelu po prawej. Kliknięty kolaż można poprawiać jak każdy inny. Zdjęcie usunięte z kolażu trafia do magazynu odłożonych, a stamtąd można je dodać do innego kolażu serii. „Zapisz wszystkie” zapisuje serię jako `nazwa_001.jpg`, `nazwa_002.jpg`… w wybranym folderze (Chrome, Edge) albo w jednym pliku ZIP (inne przeglądarki). Seria zapisuje się automatycznie w przeglądarce i wraca po odświeżeniu.
- **Cofnij / Ponów** (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y).
- **Automatyczny zapis** w przeglądarce (IndexedDB): zdjęcia, układ i kadry wracają po odświeżeniu.
- **Dodawanie zdjęć** przyciskiem lub przeciągnięciem plików na płótno.
- Na telefonie płótno zajmuje cały ekran, a w górnym pasku są przyciski „Dodaj zdjęcia” i „Opcje” – otwierają szufladę na osobnych zakładkach (zdjęcia i magazyn / układ, format, styl, eksport, projekt).

## Uruchomienie

```bash
npm install
npm run dev          # serwer deweloperski
npm run build        # dist/index.html + manifest, ikony, service worker
npm run preview      # podgląd zbudowanej wersji na porcie 4173
```

## Testy i jakość

```bash
npm run typecheck      # TypeScript (strict)
npm run lint           # oxlint (reguły React, hooków, importów); ostrzeżenia też blokują
npm test               # testy jednostkowe (Vitest, tests/unit)
npm run test:e2e       # testy w przeglądarce (Playwright, tests/e2e) – komputer i telefon
npm run test:e2e:slow  # to samo z opóźnionymi klatkami animacji
npm run test:all       # wszystko po kolei
```

Przed pierwszym `test:e2e`: `npx playwright install chromium`.

## Struktura

```
src/
  core/        czysta logika, bez Reacta i DOM – w pełni pokryta testami jednostkowymi
    types.ts     model dokumentu (drzewo podziałów, zdjęcia, arkusz)
    layouts.ts   generatory układów (auto, siatka, centralny, wiersze, kolumny)
    geometry.ts  położenie pól i krawędzi w mm – wspólne dla podglądu i eksportu
    crop.ts      kadrowanie i powiększenie
    tree.ts      operacje na drzewie (krawędzie, zamiana, usuwanie)
    restructure.ts  przebudowa drzewa bez zmiany obrazu (osobne odcinki przeciętej krawędzi)
    edges.ts     przeciąganie krawędzi: zakres (minimalne pole), przyciąganie, wybór krawędzi pod palcem
    doc.ts       reducer dokumentu (wszystkie zmiany stanu)
    history.ts   cofnij/ponów, przeciąganie = jeden krok
    export.ts    rysowanie na canvasie, rozdzielczość, limity przeglądarek
    batch.ts     seria „Kolaże z folderu”: kolejność, podział na kolaże, nazwy plików
    exif.ts      data wykonania zdjęcia z EXIF
    zip.ts       prosty zapis ZIP (seria w przeglądarkach bez wyboru folderu)
    formats.ts   formaty papieru
  storage/     zapis w IndexedDB, plik projektu .mosaic i bezpieczne odtwarzanie danych
  hooks/       useMosaic (stan + historia + autozapis), skróty, rozmiar elementu
  components/
    sidebar/     panel boczny – każda sekcja osobno
    workspace/   płótno: arkusz, pole ze zdjęciem, krawędź
  App.tsx      układ strony (panel / szuflada na telefonie)
  exporter.ts  eksport do pliku (DOM)
  autoCollage.ts  seria: wczytanie folderu, zapis wszystkich kolaży (folder / ZIP)
  pwa.ts       instalacja i komunikat „Dostępna nowa wersja”
tests/
  unit/        Vitest
  e2e/         Playwright (zdjęcia testowe w e2e/assets)
```

## Jednorazowa konfiguracja GitHub Pages

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Licencja

Apache 2.0 – zobacz [LICENSE](LICENSE).

Czcionki napisów w `public/fonts` są na licencji SIL Open Font License 1.1 – zobacz [public/fonts/OFL.txt](public/fonts/OFL.txt).
