import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addPhotos, cells, COLORS, getDoc, inPanel, openApp, pngSize } from './fixtures';

async function exportFile(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), inPanel(page, () => page.getByTestId('export').click())]);
  return { name: download.suggestedFilename(), data: readFileSync((await download.path())!) };
}

/** Colour of pixels (x, y) of an image file, decoded in the browser. */
function pixels(page: Page, data: Buffer, type: string, points: [number, number][]) {
  return page.evaluate(
    async ({ b64, mime, at }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      return { w: bmp.width, h: bmp.height, px: at.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3))) };
    },
    { b64: data.toString('base64'), mime: type, at: points },
  );
}

const near = (a: number[], b: number[], tol = 12) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);

test('the saved file looks like the preview: same cells, frame and colours', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['landscape', 'square', 'wide']);
  await inPanel(page, async () => {
    await page.getByTestId('mode-cols').click();
    await page.getByTestId('gap').fill('20');
    await page.getByTestId('frame-color').fill('#00ff00');
    await page.getByTestId('dpi').selectOption('100');
  });
  await inPanel(page, () => expect(page.getByTestId('export-size')).toHaveText('1984 × 1992 px'));
  const file = await exportFile(page);
  expect(file.name).toBe('kolaz_504x506.jpg');

  // Sample the centre of every cell and the middle of each frame, using the preview's own geometry.
  const sheet = await page.getByTestId('sheet').boundingBox();
  const boxes = await Promise.all((await cells(page).all()).map((c) => c.boundingBox()));
  const doc = await getDoc(page);
  const names = Object.fromEntries(doc.photos.map((p: { id: string; name: string }) => [p.id, p.name.replace('.jpg', '')]));
  const ids = await cells(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.photoId!));
  const k = 1984 / sheet!.width;
  const points: [number, number][] = boxes.map((b) => [Math.round((b!.x - sheet!.x + b!.width * 0.6) * k), Math.round((b!.y - sheet!.y + b!.height * 0.6) * k)]);
  // Middle of the frame between the first two cells.
  points.push([Math.round(((boxes[0]!.x + boxes[0]!.width + boxes[1]!.x) / 2 - sheet!.x) * k), 1000]);
  const { w, h, px } = await pixels(page, file.data, 'image/jpeg', points);
  expect([w, h]).toEqual([1984, 1992]);
  ids.forEach((id, i) => expect(near(px[i]!, COLORS[names[id]]!), `${names[id]}: ${px[i]}`).toBe(true));
  expect(near(px[3]!, [0, 255, 0]), `frame: ${px[3]}`).toBe(true);
});

test('PNG export with the chosen resolution', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['square']);
  await inPanel(page, async () => {
    await page.getByTestId('format').selectOption('a4');
    await page.getByTestId('type-png').click();
    await page.getByTestId('dpi').selectOption('150');
  });
  const file = await exportFile(page);
  expect(file.name).toBe('kolaz_210x297.png');
  expect(pngSize(file.data)).toEqual({ w: 1240, h: 1754 });
});

test('export settings are remembered', async ({ page }) => {
  await openApp(page);
  await inPanel(page, async () => {
    await page.getByTestId('type-png').click();
    await page.getByTestId('dpi').selectOption('300');
  });
  await page.reload();
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
  await inPanel(page, async () => {
    await expect(page.getByTestId('type-png')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('dpi')).toHaveValue('300');
  });
});
