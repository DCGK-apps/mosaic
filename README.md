# Mosaic

Aplikacja webowa (PWA) budowana do jednego pliku `index.html`, publikowana na GitHub Pages:
**https://dcgk-apps.github.io/mosaic/**

## Uruchomienie

```bash
npm install
npm run dev          # serwer deweloperski
npm run build        # dist/index.html + manifest, ikony, service worker
npm run preview      # podgląd zbudowanej wersji na porcie 4173
```

## Testy

```bash
npm run typecheck    # TypeScript (strict)
npm test             # testy jednostkowe (Vitest, tests/unit)
npm run test:e2e     # testy w przeglądarce (Playwright, tests/e2e) – komputer i telefon
npm run test:e2e:slow  # to samo z opóźnionymi klatkami animacji
npm run test:all     # wszystko po kolei
```

Przed pierwszym `test:e2e`: `npx playwright install chromium`.

## Struktura

- `src/main.ts` – punkt wejścia aplikacji
- `src/pwa.ts` – instalacja na ekranie głównym i komunikat „Dostępna nowa wersja”
- `src/sw-template.js` – service worker (praca offline); wersja jest liczona przy budowaniu w `vite.config.ts`
- `public/` – manifest i ikony (obecne ikony są zastępcze)
- `.github/workflows/ci.yml` – testy przy każdym pushu i PR
- `.github/workflows/pages.yml` – wdrożenie na GitHub Pages po pushu do `main`

## Jednorazowa konfiguracja GitHub Pages

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Licencja

Apache 2.0 – zobacz [LICENSE](LICENSE).
