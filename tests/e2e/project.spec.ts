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
  await inPanel(page, () => page.getByTestId('photo-thumb').first().getByRole('button').click(), 'photos');
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
  await inPanel(fresh, () => expect(fresh.getByTestId('magazine')).toBeVisible(), 'photos');

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

/** Clicks "Nowy projekt" in the panel; on a phone the dialog closes the drawer itself. */
async function newProject(page: Page) {
  const open = page.getByTestId('drawer-open');
  if (await open.isVisible()) await open.click();
  await page.getByTestId('project-new').click();
  await expect(page.getByTestId('new-project-dialog')).toBeVisible();
}

test('new project without saving starts an empty sheet, keeps the format and can be undone', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['square', 'wide']);
  await inPanel(page, () => page.getByTestId('rotate').click());
  const before = await getDoc(page);

  await newProject(page);
  await page.getByTestId('new-save-no').click();
  await expect(page.getByTestId('new-project-dialog')).toHaveCount(0);
  await expect(cells(page)).toHaveCount(0);
  await expect(page.locator('#toast')).toHaveText('Nowy projekt');
  const doc = await getDoc(page);
  expect(doc.photos).toEqual([]);
  expect(doc.magazine).toEqual([]);
  expect(doc.sheet).toEqual(before.sheet);

  await undoButton(page).click();
  await expect(cells(page)).toHaveCount(2);
  expect(await getDoc(page)).toEqual(before);
});

test('new project: cancel keeps the work', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['square']);
  await newProject(page);
  await page.getByTestId('new-cancel').click();
  await expect(page.getByTestId('new-project-dialog')).toHaveCount(0);
  await expect(cells(page)).toHaveCount(1);
});

test('new project: save the current one as a project file first', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['square', 'wide']);
  const before = await getDoc(page);
  await newProject(page);
  await page.getByTestId('new-save-yes').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('new-save-project').click()]);
  expect(download.suggestedFilename()).toBe('kolaz_504x506.mosaic');
  await expect(cells(page)).toHaveCount(0);

  // The saved file brings the old work back.
  await page.getByTestId('project-input').setInputFiles((await download.path())!);
  await expect(cells(page)).toHaveCount(2);
  expect(await getDoc(page)).toEqual(before);
});

test('new project: save the current one as an image first', async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['square', 'wide']);
  await newProject(page);
  await page.getByTestId('new-save-yes').click();
  await expect(page.getByTestId('new-save-image')).toContainText('JPG · 150 DPI');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('new-save-image').click()]);
  expect(download.suggestedFilename()).toMatch(/\.jpg$/);
  await expect(cells(page)).toHaveCount(0);
});

test('new project is off while there is nothing to lose', async ({ page }) => {
  await openApp(page);
  await inPanel(page, () => expect(page.getByTestId('project-new')).toBeDisabled());
});
