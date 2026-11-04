import { expect, type Page } from '@playwright/test';

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
