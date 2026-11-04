import { expect, test } from '@playwright/test';
import { addPhotos, cells, getDoc, inPanel, openApp, undoButton } from './fixtures';

test('the work comes back after reloading the page', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['landscape', 'portrait', 'square', 'wide']);
  const cell = cells(page).first();
  await cell.hover();
  await cell.getByTestId('cell-remove').click();
  await inPanel(page, async () => {
    await page.getByTestId('mode-grid').click();
    await page.getByTestId('gap').fill('12');
    await page.getByTestId('frame-color').fill('#334455');
  });
  await page.evaluate(() => (window as any).__mosaic.flush());
  const before = await getDoc(page);

  await page.reload();
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
  await expect(cells(page)).toHaveCount(3);
  expect(await getDoc(page)).toEqual(before);
  // Images really load from storage.
  for (const img of await cells(page).locator('img').all()) {
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
  }
  await inPanel(page, () => expect(page.getByTestId('magazine-item')).toHaveCount(1));
  // Undo history starts fresh after a reload.
  await expect(undoButton(page)).toBeDisabled();
});

test('a photo deleted for good is gone after a reload', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['square', 'wide']);
  await inPanel(page, async () => {
    await page.getByTestId('photo-thumb').first().getByRole('button').click();
    await page.getByTestId('magazine-delete').click();
  });
  await page.evaluate(() => (window as any).__mosaic.flush());
  await page.reload();
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
  await expect(cells(page)).toHaveCount(1);
  expect((await getDoc(page)).magazine).toEqual([]);
});
