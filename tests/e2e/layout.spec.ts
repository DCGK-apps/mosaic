import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { addPhotos, asset, box, cells, getDoc, inPanel, openApp, PHOTOS, shownPhotos } from './fixtures';

test.beforeEach(async ({ page }) => openApp(page));

test('starts with an empty canvas', async ({ page }) => {
  await expect(page.getByTestId('empty')).toContainText('Puste płótno');
  await expect(cells(page)).toHaveCount(0);
  await inPanel(page, async () => {
    await expect(page.getByTestId('export')).toBeDisabled();
    await expect(page.getByTestId('mode-auto')).toHaveCount(0); // layout options appear with photos
  });
});

test('added photos fill the sheet, each one exactly once', async ({ page }) => {
  await addPhotos(page);
  await expect(page.locator('#toast')).toHaveText('Dodano 5 zdjęć');
  const doc = await getDoc(page);
  expect((await shownPhotos(page)).toSorted()).toEqual(doc.photos.map((p: { id: string }) => p.id).toSorted());
  await inPanel(page, async () => {
    await expect(page.getByTestId('photo-thumb')).toHaveCount(5);
    await expect(page.getByTestId('auto-position')).toHaveText('1 / 1');
  });
});

for (const mode of ['grid', 'central', 'rows', 'cols', 'auto']) {
  test(`layout “${mode}” shows every photo once`, async ({ page }) => {
    await addPhotos(page);
    await inPanel(page, () => page.getByTestId(`mode-${mode === 'auto' ? 'grid' : mode}`).click());
    if (mode === 'auto') await inPanel(page, () => page.getByTestId('mode-auto').click());
    await expect(cells(page)).toHaveCount(5);
    expect(new Set(await shownPhotos(page)).size).toBe(5);
  });
}

test('grid: the last row is stretched instead of repeating photos', async ({ page }) => {
  await addPhotos(page);
  await inPanel(page, () => page.getByTestId('mode-grid').click());
  const boxes = await Promise.all((await cells(page).all()).map(box));
  const rows = new Map<number, typeof boxes>();
  for (const b of boxes) rows.set(Math.round(b.y), [...(rows.get(Math.round(b.y)) ?? []), b]);
  expect([...rows.values()].map((r) => r.length)).toEqual([3, 2]);
  const [top, bottom] = [...rows.values()];
  expect(bottom![0]!.width).toBeGreaterThan(top![0]!.width * 1.3);
});

test('“Losuj nowy” draws new layouts that can be browsed', async ({ page }) => {
  await addPhotos(page);
  const first = (await getDoc(page)).autoHistory[0];
  await inPanel(page, async () => {
    await page.getByTestId('shuffle').click();
    await expect(page.getByTestId('auto-position')).toHaveText('2 / 2');
    await page.getByTestId('auto-prev').click();
    await expect(page.getByTestId('auto-position')).toHaveText('1 / 2');
    await expect(page.getByTestId('auto-prev')).toBeDisabled();
  });
  expect((await getDoc(page)).autoHistory[0]).toEqual(first);
});

test('sheet size: preset formats, own size and orientation', async ({ page }) => {
  await addPhotos(page, ['square']);
  const ratio = async () => {
    const b = await box(page.getByTestId('sheet'));
    return b.width / b.height;
  };
  await inPanel(page, async () => {
    await page.getByTestId('format').selectOption('a4');
    await expect(page.getByTestId('width')).toHaveValue('210');
    await expect(page.getByTestId('height')).toHaveValue('297');
  });
  expect(await ratio()).toBeCloseTo(210 / 297, 2);
  await inPanel(page, async () => {
    await page.getByTestId('rotate').click();
    await expect(page.getByTestId('format')).toHaveValue('a4');
    await page.getByTestId('width').fill('400');
    await page.getByTestId('width').press('Enter');
    await expect(page.getByTestId('format')).toHaveValue('custom');
  });
  expect(await ratio()).toBeCloseTo(400 / 210, 2);
});

test('typing a size applies it only when done', async ({ page }) => {
  await inPanel(page, async () => {
    const w = page.getByTestId('width');
    await w.fill('3');
    expect((await getDoc(page)).sheet.widthMm).toBe(504);
    await w.fill('300');
    await w.blur();
    expect((await getDoc(page)).sheet.widthMm).toBe(300);
  });
});

test('photos can be dropped onto the canvas from the computer', async ({ page }) => {
  const files = ['square', 'wide'].map((n) => ({ name: `${n}.jpg`, data: readFileSync(asset(n)).toString('base64') }));
  const dt = await page.evaluateHandle((list) => {
    const t = new DataTransfer();
    for (const f of list) {
      const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
      t.items.add(new File([bytes], f.name, { type: 'image/jpeg' }));
    }
    return t;
  }, files);
  const ws = page.getByTestId('workspace');
  await ws.dispatchEvent('dragenter', { dataTransfer: dt });
  await expect(page.getByText('Upuść zdjęcia')).toBeVisible();
  await ws.dispatchEvent('drop', { dataTransfer: dt });
  await expect(cells(page)).toHaveCount(2);
  await expect(page.getByText('Upuść zdjęcia')).toBeHidden();
});

test('files that are not images are ignored', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: readFileSync(asset(PHOTOS[0])) },
  ]);
  await expect(cells(page)).toHaveCount(1);
});
