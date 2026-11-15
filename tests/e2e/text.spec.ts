import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addPhotos, box, center, getDoc, inPanel, mouseDrag, openApp, undoButton } from './fixtures';

const caption = (page: Page) => page.getByTestId('text-box');
const texts = async (page: Page) => (await getDoc(page)).texts ?? [];

test('a caption with Polish letters: style, moving, undo and autosave', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['landscape', 'square']);
  await page.getByTestId('text-add').click();
  await expect(page.getByTestId('text-input')).toBeFocused();
  await page.getByTestId('text-input').fill('Zażółć gęślą jaźń');
  await page.getByTestId('text-font').selectOption('lora');
  await page.getByTestId('text-italic').click();
  await page.getByTestId('text-size-up').click();
  await expect(caption(page)).toContainText('Zażółć gęślą jaźń');
  let [t] = await texts(page);
  expect(t).toMatchObject({ text: 'Zażółć gęślą jaźń', font: 'lora', italic: true, bold: true, x: 0.5, y: 0.5 });
  expect(t.sizeMm).toBeGreaterThan(42);

  // Dragged anywhere on the sheet; one undo step brings it back.
  await page.getByTestId('text-done').click();
  await expect(page.getByTestId('text-toolbar')).toHaveCount(0);
  const from = center(await box(caption(page)));
  await mouseDrag(page, from, { x: from.x - 60, y: from.y + 80 });
  [t] = await texts(page);
  expect(t.x).toBeLessThan(0.45);
  expect(t.y).toBeGreaterThan(0.55);
  await expect(page.getByTestId('text-toolbar')).toBeVisible();
  await undoButton(page).click();
  [t] = await texts(page);
  expect(t).toMatchObject({ x: 0.5, y: 0.5 });

  await page.evaluate(() => (window as any).__mosaic.flush());
  await page.reload();
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
  await expect(caption(page)).toContainText('Zażółć gęślą jaźń');
  expect((await texts(page))[0]).toMatchObject({ font: 'lora', italic: true });
});

test('a caption can be resized, rotated and deleted', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['landscape']);
  await page.getByTestId('text-add').click();
  const size = (await texts(page))[0].sizeMm;
  const handle = center(await box(page.getByTestId('text-resize')));
  const mid = center(await box(caption(page)));
  await mouseDrag(page, handle, { x: mid.x + (handle.x - mid.x) * 1.5, y: mid.y + (handle.y - mid.y) * 1.5 });
  expect((await texts(page))[0].sizeMm).toBeGreaterThan(size * 1.3);

  const rot = center(await box(page.getByTestId('text-rotate')));
  await mouseDrag(page, rot, { x: mid.x + 200, y: mid.y });
  expect(Math.abs((await texts(page))[0].rotation)).toBeGreaterThan(45);
  await page.getByTestId('text-unrotate').click();
  expect((await texts(page))[0].rotation).toBe(0);

  await page.getByTestId('text-delete').click();
  await expect(caption(page)).toHaveCount(0);
  expect(await texts(page)).toEqual([]);
});

test('the caption is in the exported file', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['square']);
  await page.getByTestId('text-add').click();
  await page.getByTestId('text-input').fill('ŁŁŁ');
  await page.getByTestId('text-shadow').click();
  await page.getByTestId('text-color').fill('#000000');
  await page.getByTestId('text-size-up').click();
  await page.getByTestId('text-done').click();
  await inPanel(page, async () => {
    await page.getByTestId('dpi').selectOption('100');
  });

  let data!: Buffer;
  await inPanel(page, async () => {
    await page.getByTestId('export').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('filename-save').click()]);
    data = readFileSync((await download.path())!);
  });
  // Share of dark pixels in the middle band of the sheet, where the caption is.
  const dark = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(Math.round(bmp.width * 0.3), Math.round(bmp.height * 0.45), Math.round(bmp.width * 0.4), Math.round(bmp.height * 0.1)).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! + d[i + 1]! + d[i + 2]! < 120) n++;
    return n / (d.length / 4);
  }, data.toString('base64'));
  expect(dark).toBeGreaterThan(0.03);
});
