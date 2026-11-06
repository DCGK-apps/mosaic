import { expect, test, type Page } from '@playwright/test';
import { addPhotos, cells, getDoc, inPanel, openApp, shownPhotos, undoButton } from './fixtures';

async function saveProject(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), inPanel(page, () => page.getByTestId('project-save').click())]);
  return { name: download.suggestedFilename(), path: (await download.path())! };
}

/** Every photo in the cells is drawn (its image loaded). */
const imagesLoaded = (page: Page) =>
  cells(page)
    .locator('img')
    .evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0));

test('a saved project opens in a fresh browser with the same layout, crops, settings and photos', async ({ page, browser }, testInfo) => {
  await openApp(page);
  await addPhotos(page, ['landscape', 'portrait', 'square', 'wide']);
  await inPanel(page, async () => {
    await page.getByTestId('mode-grid').click();
    await page.getByTestId('gap').fill('12');
    await page.getByTestId('frame-color').fill('#336699');
  });
  // One photo goes to the magazine – it has to come back too.
  await inPanel(page, () => page.getByTestId('photo-thumb').first().getByRole('button').click());
  await expect(cells(page)).toHaveCount(3);
  const before = await getDoc(page);
  const order = await shownPhotos(page);

  const file = await saveProject(page);
  expect(file.name).toBe('kolaz_504x506.mosaic');

  // A different browser profile: nothing autosaved, the photos only come from the file.
  const context = await browser.newContext(testInfo.project.use);
  const fresh = await context.newPage();
  await openApp(fresh);
  await expect(cells(fresh)).toHaveCount(0);
  await fresh.getByTestId('project-input').setInputFiles(file.path);
  await expect(cells(fresh)).toHaveCount(3);
  await expect(fresh.locator('#toast')).toHaveText('Otwarto projekt');
  expect(await getDoc(fresh)).toEqual(before);
  expect(await shownPhotos(fresh)).toEqual(order);
  await expect.poll(() => imagesLoaded(fresh)).toBe(true);
  await inPanel(fresh, () => expect(fresh.getByTestId('magazine')).toBeVisible());

  // …and it is autosaved like any other work.
  await fresh.evaluate(() => (window as any).__mosaic.flush());
  await fresh.reload();
  await expect(fresh.locator('body[data-ready="true"]')).toBeAttached();
  expect(await getDoc(fresh)).toEqual(before);
  await expect.poll(() => imagesLoaded(fresh)).toBe(true);
  await context.close();
});

test('opening a project can be undone', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['square', 'wide']);
  const file = await saveProject(page);
  await addPhotos(page, ['tall']);
  const current = await getDoc(page);

  await page.getByTestId('project-input').setInputFiles(file.path);
  await expect(cells(page)).toHaveCount(2);
  await undoButton(page).click();
  await expect(cells(page)).toHaveCount(3);
  expect(await getDoc(page)).toEqual(current);
});

test('a file that is not a project is refused and the work stays', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['square']);
  await page.getByTestId('project-input').setInputFiles({ name: 'notatki.mosaic', mimeType: 'text/plain', buffer: Buffer.from('to nie projekt') });
  await expect(page.locator('#toast')).toHaveText('To nie jest plik projektu Mosaic');
  await expect(cells(page)).toHaveCount(1);
});

test('saving a project is off until there is something to save', async ({ page }) => {
  await openApp(page);
  await inPanel(page, async () => {
    await expect(page.getByTestId('project-save')).toBeDisabled();
    await expect(page.getByTestId('project-open')).toBeEnabled();
  });
});
