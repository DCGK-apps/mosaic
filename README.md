# Mosaic

Kreator kolaży zdjęć do druku. Działa w przeglądarce i na telefonie (PWA, także offline), budowany do jednego pliku `index.html` i publikowany na GitHub Pages:
**https://dcgk-apps.github.io/mosaic/**

## Funkcje

- **Układy:** Auto (losuje tysiące podziałów i wybiera najlepiej pasujący do proporcji zdjęć, z historią losowań), Siatka, Centralny, Poziomo, Pionowo.
- **Krawędzie** między zdjęciami można przeciągać (myszą i palcem).
- **Kadrowanie:** przeciąganie zdjęcia, powiększanie przyciskami, kółkiem myszy lub szczypaniem. Zdjęcie zawsze wypełnia pole, nie da się zrobić pustej dziury.
- **Zamiana miejsc:** przeciągnięcie zdjęcia na inne (działa też dotykiem).
- **Magazyn odłożonych** zdjęć: odłóż, przywróć, usuń trwale.
- **Wymiary:** gotowe formaty (A4, A3, 30 × 40 cm…) lub własne, obrót pion/poziom; ramka i zaokrąglenie w milimetrach wydruku.
- **Eksport** do JPG/PNG w 100/150/300 DPI. Plik wygląda dokładnie jak podgląd (ta sama geometria).
- **Cofnij / Ponów** (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y).
- **Automatyczny zapis** w przeglądarce (IndexedDB): zdjęcia, układ i kadry wracają po odświeżeniu.
- **Dodawanie zdjęć** przyciskiem lub przeciągnięciem plików na płótno.
- Na telefonie ustawienia są w wysuwanej szufladzie, płótno zajmuje cały ekran.

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
    doc.ts       reducer dokumentu (wszystkie zmiany stanu)
    history.ts   cofnij/ponów, przeciąganie = jeden krok
    export.ts    rysowanie na canvasie, rozdzielczość, limity przeglądarek
    formats.ts   formaty papieru
  storage/     zapis w IndexedDB i bezpieczne odtwarzanie danych
  hooks/       useMosaic (stan + historia + autozapis), skróty, rozmiar elementu
  components/
    sidebar/     panel boczny – każda sekcja osobno
    workspace/   płótno: arkusz, pole ze zdjęciem, krawędź
  App.tsx      układ strony (panel / szuflada na telefonie)
  exporter.ts  eksport do pliku (DOM)
  pwa.ts       instalacja i komunikat „Dostępna nowa wersja”
tests/
  unit/        Vitest
  e2e/         Playwright (zdjęcia testowe w e2e/assets)
```

## Jednorazowa konfiguracja GitHub Pages

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Licencja

Apache 2.0 – zobacz [LICENSE](LICENSE).
