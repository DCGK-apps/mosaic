import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

export const ASSETS = join(import.meta.dirname, 'assets');
export const PHOTOS = ['landscape', 'portrait', 'square', 'wide', 'tall'] as const;
/** Colour of each test photo (outside its white top-left marker). */
export const COLORS: Record<string, [number, number, number]> = {
  landscape: [220, 38, 38],
  portrait: [22, 163, 74],
  square: [37, 99, 235],
  wide: [234, 179, 8],
  tall: [147, 51, 234],
};
export const asset = (name: string) => join(ASSETS, `${name}.jpg`);

/** Width and height from a PNG header. */
export function pngSize(buf: Buffer): { w: number; h: number } {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

export async function openApp(page: Page, opts: { installBanner?: boolean } = {}): Promise<void> {
  if (!opts.installBanner) {
    // Keep the install banner out of unrelated tests (Chrome may offer installation).
    await page.addInitScript(() => {
      try {
        const prefs = JSON.parse(localStorage.getItem('mosaic.prefs') ?? '{}');
        if (prefs.installDismissed === undefined) {
          prefs.installDismissed = true;
          localStorage.setItem('mosaic.prefs', JSON.stringify(prefs));
        }
      } catch {
        /* ignore */
      }
    });
  }
  if (process.env.SLOW_RAF) {
    // Stress mode: delay every animation frame so tests that measure the DOM
    // before the app re-rendered fail locally instead of only on fast CI runners.
    await page.addInitScript((ms) => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => raf(() => setTimeout(() => cb(performance.now()), ms));
    }, Number(process.env.SLOW_RAF) > 1 ? Number(process.env.SLOW_RAF) : 60);
  }
  await page.goto('/');
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
}

/** Adds test photos through the file picker and waits for their cells. */
export async function addPhotos(page: Page, names: readonly string[] = PHOTOS): Promise<void> {
  const before = await cells(page).count();
  await page.getByTestId('file-input').setInputFiles(names.map(asset));
  await expect(cells(page)).toHaveCount(before + names.length);
}

/** Runs `fn` with the settings visible – on a phone they are in a drawer, closed afterwards. */
export async function inPanel(page: Page, fn: () => Promise<void>): Promise<void> {
  const open = page.getByTestId('drawer-open');
  const mobile = await open.isVisible();
  if (mobile) {
    await open.click();
    await expect(page.getByTestId('drawer-close')).toBeVisible();
  }
  await fn();
  if (mobile) {
    await page.getByTestId('drawer-close').click();
    await expect(page.getByTestId('drawer-close')).not.toBeInViewport();
  }
}

export const cells = (page: Page) => page.getByTestId('cell');
/** The undo/redo buttons on screen (top bar on a phone, panel header on a computer). */
export const undoButton = (page: Page) => page.getByTestId('undo').filter({ visible: true });
export const dividers = (page: Page, dir?: 'V' | 'H') => page.locator(dir ? `[data-testid=divider][data-dir=${dir}]` : '[data-testid=divider]');

export async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('element not visible');
  return b;
}
export const center = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

export function getDoc(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).__mosaic.doc());
}

/** Photo ids in the cells, in tree order. */
export const shownPhotos = (page: Page) => cells(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.photoId!));

/** Mouse drag in small steps (pointer events like a real user). */
export async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

/** Real touch drag (touchstart/move/end → pointer events with pointerType "touch"). */
export async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= steps; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Two-finger pinch around a centre point. */
export async function pinch(page: Page, c: { x: number; y: number }, from: number, to: number, steps = 8): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const pts = (d: number) => [
    { x: c.x - d, y: c.y, id: 0 },
    { x: c.x + d, y: c.y, id: 1 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
  for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + ((to - from) * i) / steps) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
