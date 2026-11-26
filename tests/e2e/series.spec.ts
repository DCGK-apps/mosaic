import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ASSETS, asset, cells, getDoc, inPanel, openApp } from './fixtures';

const items = (page: Page) => page.getByTestId('batch-item');
const getBatch = (page: Page): Promise<any[]> => page.evaluate(() => (window as any).__mosaic.batch());

/** Makes a series from the five test photos, 2–3 per collage, in a grid. */
async function createSeries(page: Page) {
  await page.getByTestId('auto-collage').click();
  const dialog = page.getByTestId('auto-dialog');
  await page.getByTestId('auto-folder-input').setInputFiles(ASSETS);
  await expect(page.getByTestId('auto-folder-info')).toContainText('5 zdjęć');
  await page.getByTestId('auto-min').fill('2');
  await page.getByTestId('auto-max').fill('3');
  await page.getByTestId('auto-order-name').click();
  await page.getByTestId('auto-mode-grid').click();
  await dialog.getByTestId('gap').fill('3');
  await expect(page.getByTestId('auto-estimate')).toContainText('2 kolaże');
  await page.getByTestId('auto-create').click();
  await expect(dialog).toBeHidden();
  await expect(items(page)).toHaveCount(2);
}

test.describe('computer', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(!!info.project.use.isMobile, 'computer only');
    await openApp(page);
  });

  test('makes a series of collages from a folder, using every photo in order', async ({ page }) => {
    await createSeries(page);
    const batch = await getBatch(page);
    const names = batch.flatMap((d) => d.photos.map((p: any) => p.name));
    expect(names).toEqual(['landscape.jpg', 'portrait.jpg', 'square.jpg', 'tall.jpg', 'wide.jpg']);
    for (const d of batch) {
      expect(d.photos.length).toBeGreaterThanOrEqual(2);
      expect(d.photos.length).toBeLessThanOrEqual(3);
      expect(d.mode).toBe('grid');
      expect(d.sheet.gapMm).toBe(3);
    }
    // The first collage is on the sheet, its thumbnail is marked and drawn.
    await expect(cells(page)).toHaveCount(batch[0].photos.length);
    await expect(items(page).first()).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-testid=batch-canvas][data-drawn=true]')).toHaveCount(2);
  });

  test('photos in subfolders are left out unless the user asks for them', async ({ page }) => {
    const root = join(test.info().outputPath('pick'), 'Wakacje');
    mkdirSync(join(root, 'Dzien2'), { recursive: true });
    for (const n of ['landscape', 'portrait', 'square']) copyFileSync(asset(n), join(root, `${n}.jpg`));
    for (const n of ['tall', 'wide']) copyFileSync(asset(n), join(root, 'Dzien2', `${n}.jpg`));

    await page.getByTestId('auto-collage').click();
    await expect(page.getByTestId('auto-subfolders')).not.toBeChecked();
    await expect(page.getByTestId('auto-privacy')).toContainText('nie są nigdzie wysyłane');
    await page.getByTestId('auto-folder-input').setInputFiles(root);
    await expect(page.getByTestId('auto-folder-info')).toHaveText('Wakacje: 3 zdjęcia');
    await expect(page.getByTestId('auto-privacy')).toBeHidden();
    // Ticking the box counts the photos in subfolders at once; unticking takes them away again.
    await page.getByTestId('auto-subfolders').check();
    await expect(page.getByTestId('auto-folder-info')).toHaveText('Wakacje: 5 zdjęć');
    await page.getByTestId('auto-subfolders').uncheck();
    await expect(page.getByTestId('auto-folder-info')).toHaveText('Wakacje: 3 zdjęcia');
    await page.getByTestId('auto-min').fill('5');
    await page.getByTestId('auto-max').fill('5');
    await page.getByTestId('auto-create').click();
    await expect(items(page)).toHaveCount(1);
    expect((await getBatch(page))[0].photos.map((p: any) => p.name)).toEqual(['landscape.jpg', 'portrait.jpg', 'square.jpg']);

    // With subfolders – and the choice is remembered.
    await page.getByTestId('batch-hide').click();
    await page.getByTestId('auto-collage').click();
    await page.getByTestId('auto-subfolders').check();
    await page.getByTestId('auto-folder-input').setInputFiles(root);
    await expect(page.getByTestId('auto-folder-info')).toHaveText('Wakacje: 5 zdjęć');
    await page.getByTestId('auto-create').click();
    await expect(page.getByTestId('auto-dialog')).toBeHidden();
    expect((await getBatch(page))[0].photos.length).toBe(5);
    await page.getByTestId('auto-collage').click();
    await expect(page.getByTestId('auto-subfolders')).toBeChecked();
  });

  test('a collage can be corrected; removed photos go to the magazine and into another collage', async ({ page }) => {
    await createSeries(page);
    const [first, second] = await getBatch(page);

    await items(page).nth(1).click();
    await expect(items(page).nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(cells(page)).toHaveCount(second.photos.length);
    expect((await getDoc(page)).batchKey).toBe(second.batchKey);

    const cell = cells(page).first();
    await cell.hover();
    await cell.getByTestId('cell-remove').click();
    await expect(cells(page)).toHaveCount(second.photos.length - 1);
    await expect(page.getByTestId('magazine-item')).toHaveCount(1);
    await expect(items(page).nth(1)).toContainText(`${second.photos.length - 1} zdj.`);

    // Back to the first collage: the magazine stays, its photo can join this collage.
    await items(page).first().click();
    await expect(cells(page)).toHaveCount(first.photos.length);
    await page.getByTestId('magazine-item').hover();
    await page.getByTestId('magazine-restore').click();
    await expect(cells(page)).toHaveCount(first.photos.length + 1);

    const batch = await getBatch(page);
    expect(batch[0].photos.length).toBe(first.photos.length + 1);
    expect(batch[1].photos.length).toBe(second.photos.length - 1);

    // Undo goes back through the switch between collages.
    await page.keyboard.press('Control+z');
    await expect(cells(page)).toHaveCount(first.photos.length);
    await page.keyboard.press('Control+z');
    await expect(items(page).nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(cells(page)).toHaveCount(second.photos.length - 1);
  });

  test('saves all collages into a chosen folder as name_001, name_002…', async ({ page }) => {
    await page.addInitScript(() => {
      const written: Record<string, number> = { 'wakacje_002.jpg': 1 };
      (window as any).__written = written;
      (window as any).showDirectoryPicker = async () => ({
        name: 'Kolaże',
        getFileHandle: async (name: string, opts?: { create?: boolean }) => {
          if (!(name in written) && !opts?.create) throw new DOMException('missing', 'NotFoundError');
          return {
            createWritable: async () => ({
              write: async (blob: Blob) => void (written[name] = blob.size),
              close: async () => undefined,
            }),
          };
        },
      });
    });
    await page.reload();
    await createSeries(page);
    await page.getByTestId('batch-save-all').click();
    await page.getByTestId('series-name').fill('wakacje');
    await expect(page.getByTestId('series-names')).toHaveText('wakacje_001.jpg … wakacje_002.jpg');
    await page.getByTestId('series-save').click();
    // wakacje_002.jpg is already there – ask before replacing it.
    await expect(page.getByTestId('series-overwrite')).toContainText('wakacje_002.jpg');
    await page.getByTestId('series-overwrite-yes').click();
    await expect(page.getByTestId('series-save-dialog')).toBeHidden();
    const written = await page.evaluate(() => (window as any).__written);
    expect(Object.keys(written).toSorted()).toEqual(['wakacje_001.jpg', 'wakacje_002.jpg']);
    expect(written['wakacje_001.jpg']).toBeGreaterThan(1000);
    expect(written['wakacje_002.jpg']).toBeGreaterThan(1000);
  });

  test('a collage that fails does not stop the others; it is reported and can be saved again', async ({ page }) => {
    await page.addInitScript(() => {
      const written: string[] = [];
      let failNext = true;
      (window as any).__written = written;
      (window as any).showDirectoryPicker = async () => ({
        name: 'Kolaże',
        getFileHandle: async (name: string, opts?: { create?: boolean }) => {
          if (!opts?.create) throw new DOMException('missing', 'NotFoundError');
          return {
            createWritable: async () => {
              // The first collage cannot be written once (e.g. the file is open in another program).
              if (name.endsWith('_001.jpg') && failNext) {
                failNext = false;
                throw new DOMException('busy', 'NoModificationAllowedError');
              }
              return { write: async () => void written.push(name), close: async () => undefined };
            },
          };
        },
      });
    });
    await page.reload();
    await createSeries(page);
    await page.getByTestId('batch-save-all').click();
    await page.getByTestId('series-name').fill('lato');
    await page.getByTestId('series-save').click();
    await expect(page.getByTestId('series-report')).toContainText('Zapisano 1 z 2');
    await expect(page.getByTestId('series-failed')).toHaveText(/lato_001\.jpg – plik jest otwarty w innym programie/);
    expect(await page.evaluate(() => (window as any).__written)).toEqual(['lato_002.jpg']);

    await page.getByTestId('series-retry').click();
    await expect(page.getByTestId('series-save-dialog')).toBeHidden();
    expect(await page.evaluate(() => (window as any).__written)).toEqual(['lato_002.jpg', 'lato_001.jpg']);
    await expect(page.locator('#toast')).toHaveText('Zapisano 2 kolaże w folderze Kolaże');
  });

  test('empty collages are not saved, and the dialog says so', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).showDirectoryPicker = undefined;
    });
    await page.reload();
    await createSeries(page);
    const [first] = await getBatch(page);
    for (let i = 0; i < first.photos.length; i++) {
      const cell = cells(page).first();
      await cell.hover();
      await cell.getByTestId('cell-remove').click();
    }
    await expect(cells(page)).toHaveCount(0);
    await page.getByTestId('batch-save-all').click();
    await page.getByTestId('series-name').fill('lato');
    await expect(page.getByTestId('series-empty')).toHaveText('Pusty kolaż (bez zdjęć) nie zostanie zapisany: lato_001.jpg.');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('series-save').click()]);
    const zip = readFileSync(await download.path());
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(1);
    expect(zip.includes(Buffer.from('lato_002.jpg'))).toBe(true);
  });

  test('without folder access the series is saved as one ZIP file', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).showDirectoryPicker = undefined;
    });
    await page.reload();
    await createSeries(page);
    await page.getByTestId('batch-save-all').click();
    await page.getByTestId('series-name').fill('lato');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('series-save').click()]);
    expect(download.suggestedFilename()).toBe('lato.zip');
    const zip = readFileSync(await download.path());
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(zip.readUInt16LE(end + 10)).toBe(2);
    expect(zip.includes(Buffer.from('lato_001.jpg'))).toBe(true);
    expect(zip.includes(Buffer.from('lato_002.jpg'))).toBe(true);
  });

  test('random order uses every photo once and is remembered', async ({ page }) => {
    await page.getByTestId('auto-collage').click();
    await page.getByTestId('auto-folder-input').setInputFiles(ASSETS);
    await page.getByTestId('auto-order-random').click();
    await expect(page.getByTestId('auto-order-random')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('auto-dialog')).toContainText('Zdjęcia zostaną wymieszane');
    await page.getByTestId('auto-min').fill('2');
    await page.getByTestId('auto-max').fill('3');
    await page.getByTestId('auto-create').click();
    await expect(items(page)).toHaveCount(2);
    const names = (await getBatch(page)).flatMap((d) => d.photos.map((p: any) => p.name));
    expect(names.toSorted()).toEqual(['landscape.jpg', 'portrait.jpg', 'square.jpg', 'tall.jpg', 'wide.jpg']);

    await page.getByTestId('batch-hide').click();
    await page.getByTestId('auto-collage').click();
    await expect(page.getByTestId('auto-order-random')).toHaveAttribute('aria-checked', 'true');
  });

  test('"Zrób N kolaży" splits the photos evenly into that many collages', async ({ page }) => {
    await page.getByTestId('auto-collage').click();
    await page.getByTestId('auto-folder-input').setInputFiles(ASSETS);
    await page.getByTestId('auto-split-count').click();
    await page.getByTestId('auto-mode-grid').click();

    // More collages than photos: the app says so and offers one per photo.
    await page.getByTestId('auto-count').fill('8');
    await expect(page.getByTestId('auto-count-problem')).toContainText('Zdjęć jest tylko 5');
    await expect(page.getByTestId('auto-create')).toBeDisabled();
    await page.getByTestId('auto-count-fix').click();
    await expect(page.getByTestId('auto-count')).toHaveValue('5');
    await expect(page.getByTestId('auto-count-problem')).toBeHidden();

    await page.getByTestId('auto-count').fill('2');
    await expect(page.getByTestId('auto-estimate')).toContainText('po 2–3 zdjęcia');
    await page.getByTestId('auto-create').click();
    await expect(page.getByTestId('auto-dialog')).toBeHidden();
    await expect(items(page)).toHaveCount(2);
    const sizes = (await getBatch(page)).map((d) => d.photos.length);
    expect(sizes.toSorted()).toEqual([2, 3]);

    // The choice is remembered.
    await page.getByTestId('batch-hide').click();
    await page.getByTestId('auto-collage').click();
    await expect(page.getByTestId('auto-split-count')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('auto-count')).toHaveValue('2');
  });

  test('big collages need a confirmation, and more than 40 photos in one is not allowed', async ({ page }) => {
    const root = join(test.info().outputPath('pick'), 'Duzo');
    mkdirSync(root, { recursive: true });
    const names = ['landscape', 'portrait', 'square', 'tall', 'wide'];
    for (let i = 0; i < 41; i++) copyFileSync(asset(names[i % names.length]!), join(root, `IMG_${i}.jpg`));

    const open = async () => {
      await page.getByTestId('auto-collage').click();
      await page.getByTestId('auto-folder-input').setInputFiles(root);
      await expect(page.getByTestId('auto-folder-info')).toContainText('41 zdjęć');
    };
    await open();
    await page.getByTestId('auto-split-count').click();
    await page.getByTestId('auto-mode-grid').click();

    // 41 in one collage: over the limit of 40.
    await page.getByTestId('auto-count').fill('1');
    await expect(page.getByTestId('auto-count-problem')).toContainText('najwyżej 40');
    await expect(page.getByTestId('auto-create')).toBeDisabled();

    // 20–21 per collage: allowed, but the app warns first.
    await page.getByTestId('auto-count').fill('2');
    await page.getByTestId('auto-create').click();
    await expect(page.getByTestId('auto-large')).toContainText('po 20–21 zdjęć');
    await page.getByTestId('auto-large-back').click();
    await expect(page.getByTestId('auto-large')).toBeHidden();
    await expect(page.getByTestId('auto-dialog')).toBeVisible();

    await page.getByTestId('auto-create').click();
    await expect(page.getByTestId('auto-large-suggest')).toHaveText(/Dobrze, zrób 3 kolaże/);
    await page.getByTestId('auto-large-suggest').click();
    await expect(page.getByTestId('auto-dialog')).toBeHidden();
    await expect(items(page)).toHaveCount(3);

    await page.getByTestId('batch-hide').click();
    await open();
    await expect(page.getByTestId('auto-count')).toHaveValue('3');
    await page.getByTestId('auto-count').fill('2');
    await page.getByTestId('auto-create').click();
    await page.getByTestId('auto-large-anyway').click();
    await expect(page.getByTestId('auto-dialog')).toBeHidden();
    await expect(items(page)).toHaveCount(2);
    expect((await getBatch(page)).map((d) => d.photos.length).toSorted()).toEqual([20, 21]);
  });

  test('the series comes back after reloading the page, and can be closed', async ({ page }) => {
    await createSeries(page);
    await items(page).nth(1).click();
    await page.evaluate(() => (window as any).__mosaic.flush());
    const before = await getBatch(page);

    await page.reload();
    await expect(page.locator('body[data-ready="true"]')).toBeAttached();
    await expect(items(page)).toHaveCount(2);
    expect(await getBatch(page)).toEqual(before);
    await expect(items(page).nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-testid=batch-canvas][data-drawn=true]')).toHaveCount(2);

    // The panel hides to a narrow strip and comes back.
    await page.getByTestId('batch-hide').click();
    await expect(page.getByTestId('batch-panel')).toBeHidden();
    await page.getByTestId('batch-toggle').click();
    await expect(page.getByTestId('batch-panel')).toBeVisible();

    await page.getByTestId('batch-close').click();
    await page.getByTestId('batch-close-yes').click();
    await expect(page.getByTestId('batch-panel')).toBeHidden();
    // The collage on the sheet stays.
    await expect(cells(page)).toHaveCount(before[1].photos.length);
  });
});

test('on a phone there is no automatic series', async ({ page }, info) => {
  test.skip(!info.project.use.isMobile, 'phone layout');
  await openApp(page);
  await inPanel(page, () => expect(page.getByTestId('auto-collage')).toHaveCount(0), 'photos');
});
