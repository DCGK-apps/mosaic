import { expect, test } from '@playwright/test';
import { addPhotos, box, cells, center, dividers, getDoc, inPanel, openApp, pinch, shownPhotos, touchDrag } from './fixtures';

test.beforeEach(async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'touch-only');
  await openApp(page);
  await addPhotos(page, ['landscape', 'portrait', 'square']);
  await inPanel(page, () => page.getByTestId('mode-cols').click());
});

test('a finger drags a divider', async ({ page }) => {
  const w0 = (await box(cells(page).first())).width;
  const d = center(await box(dividers(page).first()));
  await touchDrag(page, d, { x: d.x + 40, y: d.y });
  await expect.poll(async () => (await box(cells(page).first())).width).toBeGreaterThan(w0 + 30);
});

test('a finger moves the crop', async ({ page }) => {
  const c = center(await box(cells(page).first()));
  await touchDrag(page, c, { x: c.x + 30, y: c.y });
  await expect.poll(async () => (await getDoc(page)).photos[0].crop.x).toBeGreaterThan(0);
});

test('pinching zooms the photo', async ({ page }) => {
  const c = center(await box(cells(page).nth(2)));
  await pinch(page, c, 15, 45);
  await expect.poll(async () => (await getDoc(page)).photos[2].crop.zoom).toBeGreaterThan(2);
});

test('tapping a photo shows its controls (there is no hover on a phone)', async ({ page }) => {
  const cell = cells(page).first();
  await expect(cell.getByTestId('cell-remove')).toHaveCSS('opacity', '0');
  const c = center(await box(cell));
  await page.touchscreen.tap(c.x, c.y);
  await expect(cell.getByTestId('cell-remove')).toHaveCSS('opacity', '1');
  await cell.getByTestId('zoom-in').tap();
  await expect(cell.getByTestId('zoom-value')).toHaveText('110%');
});

test('photos are swapped by dragging with a finger', async ({ page }) => {
  const before = await shownPhotos(page);
  await inPanel(page, () => page.getByTestId('tool-swap').click());
  const a = center(await box(cells(page).nth(0)));
  const b = center(await box(cells(page).nth(1)));
  await touchDrag(page, a, b);
  await expect.poll(() => shownPhotos(page)).toEqual([before[1], before[0], before[2]]);
});
