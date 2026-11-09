import { expect, test } from '@playwright/test';
import { addPhotos, box, cells, getDoc, openApp } from './fixtures';

test.beforeEach(async ({ page }, info) => {
  test.skip(!info.project.use.isMobile, 'phone layout');
  await openApp(page);
});

test('on a phone the settings are a drawer and the sheet gets the whole screen', async ({ page }) => {
  await addPhotos(page, ['square', 'wide']);
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar).not.toBeInViewport();
  const sheet = await box(page.getByTestId('sheet'));
  expect(sheet.width).toBeGreaterThan((page.viewportSize()!.width * 0.85));

  await page.getByTestId('drawer-open').click();
  await expect(sidebar).toBeInViewport();
  await page.getByTestId('mode-rows').click();
  await page.getByTestId('drawer-backdrop').click({ position: { x: 10, y: 10 } });
  await expect(sidebar).not.toBeInViewport();
  await expect(cells(page)).toHaveCount(2);
});

test('undo is in the top bar', async ({ page }) => {
  await addPhotos(page, ['square']);
  await page.getByTestId('drawer-open').click();
  await page.getByTestId('rotate').click();
  await page.getByTestId('drawer-close').click();
  expect((await getDoc(page)).sheet.widthMm).toBe(506);
  await page.locator('header').getByTestId('undo').click();
  await expect.poll(async () => (await getDoc(page)).sheet.widthMm).toBe(504);
});

test('"Dodaj zdjęcia" and "Opcje" open separate tabs of the drawer', async ({ page }) => {
  await addPhotos(page, ['square']);
  await expect(page.getByTestId('drawer-open')).toHaveText('Opcje');

  await page.getByTestId('drawer-photos').click();
  await expect(page.getByTestId('add-photos')).toBeInViewport();
  await expect(page.getByTestId('photo-thumb')).toHaveCount(1);
  await expect(page.getByTestId('rotate')).toBeHidden();
  // Switch tabs inside the drawer.
  await page.getByTestId('tab-options').click();
  await expect(page.getByTestId('rotate')).toBeVisible();
  await expect(page.getByTestId('add-photos')).toBeHidden();
  await page.getByTestId('drawer-close').click();

  await page.getByTestId('drawer-open').click();
  await expect(page.getByTestId('tab-options')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('add-photos')).toBeHidden();
  await expect(page.getByTestId('project-new')).toBeVisible();
});
