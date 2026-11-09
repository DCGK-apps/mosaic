import { expect, test, type Page } from '@playwright/test';
import { addPhotos, box, cells, center, dividers, getDoc, inPanel, mouseDrag, openApp, shownPhotos, undoButton } from './fixtures';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await addPhotos(page, ['landscape', 'portrait', 'square']);
  await inPanel(page, () => page.getByTestId('mode-cols').click());
});

const photoBox = (page: Page, i: number) => box(cells(page).nth(i).locator('img'));

test('dragging a divider resizes the neighbouring photos; undo restores it in one step', async ({ page }) => {
  const w0 = (await box(cells(page).first())).width;
  const d = center(await box(dividers(page, 'V').first()));
  await mouseDrag(page, d, { x: d.x + 40, y: d.y });
  await expect.poll(async () => (await box(cells(page).first())).width).toBeGreaterThan(w0 + 30);
  await undoButton(page).click();
  await expect.poll(async () => (await box(cells(page).first())).width).toBeCloseTo(w0, 0);
  await expect(undoButton(page)).toBeEnabled(); // the layout change before is still there
});

test('a divider stops at 10% / 90%', async ({ page }) => {
  const d = center(await box(dividers(page, 'V').first()));
  await mouseDrag(page, d, { x: 0, y: d.y });
  const split = (await getDoc(page)).tree;
  expect(split.frac).toBeCloseTo(0.1);
});

test('dragging a photo moves the crop, never leaving an empty gap', async ({ page }) => {
  const cell = await box(cells(page).first()); // landscape photo in a tall cell: overflows left/right
  const before = await photoBox(page, 0);
  await mouseDrag(page, center(cell), { x: center(cell).x + 30, y: center(cell).y });
  await expect.poll(async () => (await photoBox(page, 0)).x).toBeGreaterThan(before.x + 20);
  // Way too far: stops with the photo's edge at the cell's edge.
  await mouseDrag(page, center(cell), { x: center(cell).x + 2000, y: center(cell).y });
  const after = await photoBox(page, 0);
  expect(after.x).toBeCloseTo(cell.x, 0);
  expect(after.x + after.width).toBeGreaterThanOrEqual(cell.x + cell.width - 1);
  expect((await getDoc(page)).photos[0].crop.x).toBe(1);
});

test('zoom buttons and the mouse wheel magnify the photo (100–300%)', async ({ page }) => {
  const cell = cells(page).first();
  await cell.hover();
  await cell.getByTestId('zoom-in').click();
  await expect(cell.getByTestId('zoom-value')).toHaveText('110%');
  await cell.getByTestId('zoom-out').click();
  await cell.getByTestId('zoom-out').click();
  await expect(cell.getByTestId('zoom-value')).toHaveText('100%');
  await page.mouse.wheel(0, -100);
  await expect(cell.getByTestId('zoom-value')).toHaveText('110%');
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -100);
  await expect(cell.getByTestId('zoom-value')).toHaveText('300%');
});

test('swap mode: dragging a photo onto another swaps them', async ({ page }) => {
  const before = await shownPhotos(page);
  await inPanel(page, () => page.getByTestId('tool-swap').click());
  await expect(dividers(page)).toHaveCount(0);
  const a = center(await box(cells(page).nth(0)));
  const c = center(await box(cells(page).nth(2)));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(c.x, c.y, { steps: 8 });
  await expect(page.getByTestId('swap-ghost')).toBeVisible();
  await page.mouse.up();
  await expect.poll(() => shownPhotos(page)).toEqual([before[2], before[1], before[0]]);
  await expect(page.getByTestId('swap-ghost')).toHaveCount(0);
});

test('magazine: put aside, bring back, delete for good', async ({ page }) => {
  const cell = cells(page).nth(1);
  const id = await cell.getAttribute('data-photo-id');
  await cell.hover();
  await cell.getByTestId('cell-remove').click();
  await expect(cells(page)).toHaveCount(2);
  await inPanel(page, async () => {
    await expect(page.getByTestId('magazine-item')).toHaveCount(1);
    await page.getByTestId('magazine-restore').click();
    await expect(page.getByTestId('magazine')).toHaveCount(0);
  }, 'photos');
  await expect(cells(page)).toHaveCount(3);
  expect(await shownPhotos(page)).toContain(id);
  await inPanel(page, async () => {
    await page.getByTestId('photo-thumb').first().getByRole('button').click();
    await page.getByTestId('magazine-delete').click();
    await expect(page.getByTestId('magazine')).toHaveCount(0);
    await expect(page.getByTestId('photo-thumb')).toHaveCount(2);
  }, 'photos');
});

test('undo/redo with the keyboard', async ({ page }, info) => {
  test.skip(!!info.project.use.hasTouch, 'keyboard');
  await page.getByTestId('mode-grid').click();
  await page.keyboard.press('Control+z');
  expect((await getDoc(page)).mode).toBe('cols');
  await page.keyboard.press('Control+Shift+z');
  expect((await getDoc(page)).mode).toBe('grid');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+y');
  expect((await getDoc(page)).mode).toBe('grid');
});

test('frame and corners are in millimetres of the print', async ({ page }) => {
  await inPanel(page, async () => {
    await page.getByTestId('gap').fill('0');
    await page.getByTestId('radius').fill('20');
  });
  const [a, b] = [await box(cells(page).nth(0)), await box(cells(page).nth(1))];
  expect(b.x - (a.x + a.width)).toBeCloseTo(0, 0);
  const sheet = await box(page.getByTestId('sheet'));
  const radius = await cells(page).first().evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius));
  expect(radius).toBeCloseTo((20 * sheet.width) / 504, 0);
  await inPanel(page, () => page.getByTestId('gap').fill('30'));
  const [c, d] = [await box(cells(page).nth(0)), await box(cells(page).nth(1))];
  expect(d.x - (c.x + c.width)).toBeCloseTo((30 * sheet.width) / 504, 0);
});
