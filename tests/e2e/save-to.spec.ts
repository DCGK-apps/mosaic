import { expect, test } from '@playwright/test';
import { addPhotos, openApp } from './fixtures';

test.beforeEach(async ({ page }, info) => {
  test.skip(!!info.project.use.isMobile, 'the "Save as" window is a computer feature');
  // A stand-in for the system "Save as" window: the user keeps or changes the name, or closes it.
  await page.addInitScript(() => {
    const w = window as any;
    w.__saved = [];
    w.__answer = null; // null = close the window, otherwise the chosen file name
    w.showSaveFilePicker = async (opts: { suggestedName: string; id: string; types: { accept: Record<string, string[]> }[] }) => {
      w.__picker = opts;
      if (!w.__answer) throw new DOMException('closed', 'AbortError');
      const name = w.__answer;
      return { name, createWritable: async () => ({ write: async (b: Blob) => void w.__saved.push([name, b.size]), close: async () => undefined }) };
    };
  });
  await openApp(page);
  await addPhotos(page, ['landscape', 'portrait']);
});

test('a single collage can be saved into a folder chosen in the "Save as" window', async ({ page }) => {
  await page.getByTestId('export').click();
  await expect(page.getByTestId('filename-hint')).toBeVisible();
  await page.getByTestId('filename-input').fill('wakacje');

  // Closing the window keeps the name dialog open.
  await page.getByTestId('filename-save-to').click();
  await expect(page.getByTestId('filename-dialog')).toBeVisible();
  const picker = await page.evaluate(() => (window as any).__picker);
  expect(picker.suggestedName).toBe('wakacje.jpg');
  expect(picker.id).toBe('mosaic-image');
  expect(picker.types[0].accept).toEqual({ 'image/jpeg': ['.jpg'] });

  // The name changed in the window is the one remembered for the next save.
  await page.evaluate(() => ((window as any).__answer = 'morze.jpg'));
  await page.getByTestId('filename-save-to').click();
  await expect(page.getByTestId('filename-dialog')).toBeHidden();
  await expect(page.locator('#toast')).toHaveText('Zapisano: morze.jpg');
  const saved = await page.evaluate(() => (window as any).__saved);
  expect(saved[0][0]).toBe('morze.jpg');
  expect(saved[0][1]).toBeGreaterThan(1000);

  await page.getByTestId('export').click();
  await expect(page.getByTestId('filename-input')).toHaveValue('morze01');
});

test('a project can be saved into a chosen folder too', async ({ page }) => {
  await page.evaluate(() => ((window as any).__answer = 'album.mosaic'));
  await page.getByTestId('project-save').click();
  await page.getByTestId('filename-input').fill('album');
  await page.getByTestId('filename-save-to').click();
  await expect(page.getByTestId('filename-dialog')).toBeHidden();
  const picker = await page.evaluate(() => (window as any).__picker);
  expect(picker.suggestedName).toBe('album.mosaic');
  expect(picker.id).toBe('mosaic-project');
  const saved = await page.evaluate(() => (window as any).__saved);
  expect(saved[0][0]).toBe('album.mosaic');
});
